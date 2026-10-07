const mongoose = require("mongoose");
const Project = require("../models/projectModel");
const ProductBacklog = require("../models/productBacklogModel");
const UserStory = require("../models/userStoryModel");
const Sprint = require("../models/sprintModel");
const Task = require("../models/taskModel");
const ScrumEvent = require("../models/scrumEventModel");
const Increment = require("../models/incrementModel");
const Notification = require("../models/notificationModel");
const Team = require("../models/teamModel");
const Member = require("../models/memberModel");
const User = require("../models/userModel");
const ApiFeatures = require("../utils/apiFeatures");
const pickFields = require("../utils/pickFields");
const { BadRequestError, ForbiddenError, NotFoundError, ConflictError } = require("../utils/appError");
const { runInTransaction } = require("../lib/database");
const { toSavedPath, findFile, deleteFiles } = require("../lib/fileStorage");

const PROJECT_FIELDS = [
  "name",
  "description",
  "startDate",
  "endDate",
  "budget",
  "priority",
  "status",
  "definitionOfDone",
];

// Role of a user in a project : "Admin", "Client", their Scrum role in the team, or null
// (the admin manages the platform but has no Scrum role in the projects)
const getProjectRole = async (project, team, user) => {
  if (user.type === "Admin") return "Admin";
  if (project.client && project.client.equals(user.id)) return "Client";

  const member = team ? await Member.findOne({ team: team._id, user: user.id }) : null;
  return member ? member.role : null;
};

// Project of a route (/projects/:projectId/...) and role of the logged-in user in it, used by projectMiddleware :
// - a user with no role gets the same answer as for an unknown project (an outsider cannot find the ids)
// - a done project is read-only (the admin can reopen it with PATCH /projects/:projectId)
exports.checkProjectAccess = async (projectId, user, allowedRoles, isReadOnly) => {
  if (!mongoose.isObjectIdOrHexString(projectId)) {
    throw new BadRequestError("Invalid id");
  }

  // the project and its team are read at the same time
  const [project, team] = await Promise.all([Project.findById(projectId), Team.findOne({ project: projectId })]);
  const role = project ? await getProjectRole(project, team, user) : null;
  if (!role) {
    throw new NotFoundError("Project not found!");
  }
  if (!allowedRoles.includes(role)) {
    throw new ForbiddenError(`Access denied, you must be ${allowedRoles.join(" or ")} in this project`);
  }
  if (project.status === "Done" && !isReadOnly) {
    throw new ConflictError("This project is done : its content is read-only (the admin can reopen it)!");
  }
  return { project, role };
};

// Check that the client is a user of type Client
const checkClient = async (clientId) => {
  if (!clientId) return;
  const client = await User.findById(clientId);
  if (!client || client.type !== "Client") {
    throw new BadRequestError("The client must be a user of type Client!");
  }
};

// Create a project with its product backlog (saved together)
exports.createProject = async (data, uploadedFiles) => {
  await checkClient(data.client);

  return await runInTransaction(async (session) => {
    const [productBacklog] = await ProductBacklog.create([{ name: `Product Backlog - ${data.name}` }], { session });

    const project = new Project({
      ...pickFields(data, PROJECT_FIELDS),
      client: data.client || null,
      productBacklog: productBacklog._id,
      images: uploadedFiles.images,
      files: uploadedFiles.files,
    });

    return await project.save({ session });
  });
};

// Get all the projects (the admin sees all the projects, the others see their projects)
exports.getAllProjects = async (user, query) => {
  let filter = {};

  if (user.type !== "Admin") {
    const members = await Member.find({ user: user.id });
    const teams = await Team.find({ _id: { $in: members.map((member) => member.team) } });
    filter = {
      $or: [{ _id: { $in: teams.map((team) => team.project) } }, { client: user.id }],
    };
  }

  const features = new ApiFeatures(Project.find(filter).populate("team"), query).filter().sort().pagination();

  return await features.execute();
};

// Get a project with its team, sprints and increments
exports.getProjectById = async (projectId) => {
  return await Project.findById(projectId)
    .populate({
      path: "team",
      populate: { path: "members", populate: { path: "user", select: "name email" } },
    })
    .populate("sprints increments")
    .populate("client", "name email")
    .populate("productBacklog", "name productGoal");
};

// Stored image or file of the project : only the files attached to this project can be read
// (the name is compared to the saved paths, so a name like ../.env is never found)
exports.getProjectFile = async (project, fileName) => {
  if (![...project.images, ...project.files].includes(toSavedPath(fileName))) {
    throw new NotFoundError("File not found!");
  }
  // a file saved on the disk of the server by an old version no longer exists
  const file = await findFile(fileName);
  if (!file) {
    throw new NotFoundError("File not found!");
  }
  return file;
};

// The admin removes an image or a file from a project (and deletes it)
exports.deleteProjectFile = async (projectId, fileName) => {
  const savedPath = toSavedPath(fileName);
  const project = await Project.findOneAndUpdate(
    { _id: projectId, $or: [{ images: savedPath }, { files: savedPath }] },
    { $pull: { images: savedPath, files: savedPath } },
    { new: true },
  );
  if (!project) {
    throw new NotFoundError("File not found in this project!");
  }
  await deleteFiles([savedPath]);
  return project;
};

// Update a project (only the sent fields, the new files are added to the existing ones)
exports.updateProject = async (projectId, data, uploadedFiles) => {
  const project = await Project.findById(projectId);
  if (!project) {
    throw new NotFoundError("Project not found!");
  }

  await checkClient(data.client);

  project.set(pickFields(data, PROJECT_FIELDS));
  if (data.client !== undefined) {
    project.client = data.client || null;
  }
  project.images = [...project.images, ...uploadedFiles.images];
  project.files = [...project.files, ...uploadedFiles.files];

  // a project is closed once its sprint in progress is over (a done project is read-only)
  if (
    project.isModified("status") &&
    project.status === "Done" &&
    (await Sprint.exists({ project: project._id, status: "In progress" }))
  ) {
    throw new ConflictError("Complete or cancel the sprint in progress before closing the project!");
  }

  // The sprints must stay inside the project dates
  const sprintOutside = await Sprint.findOne({
    project: project._id,
    status: { $ne: "Cancelled" },
    $or: [{ startDate: { $lt: project.startDate } }, { endDate: { $gt: project.endDate } }],
  });
  if (sprintOutside) {
    throw new ConflictError(`The sprint "${sprintOutside.name}" is outside the new project dates!`);
  }

  return await project.save();
};

// Delete a project with all its data (in one transaction)
exports.deleteProject = async (projectId) => {
  const project = await runInTransaction(async (session) => {
    const project = await Project.findById(projectId, null, { session });
    if (!project) {
      throw new NotFoundError("Project not found!");
    }

    // sprints, events, increments, notifications and tasks of the project
    await ScrumEvent.deleteMany({ project: project._id }, { session });
    await Increment.deleteMany({ project: project._id }, { session });
    await Notification.deleteMany({ project: project._id }, { session });
    await Task.deleteMany({ project: project._id }, { session });
    await Sprint.deleteMany({ project: project._id }, { session });

    // product backlog and its user stories
    await UserStory.deleteMany({ productBacklog: project.productBacklog }, { session });
    await ProductBacklog.deleteOne({ _id: project.productBacklog }, { session });

    // team and its members
    const team = await Team.findOne({ project: project._id }, null, { session });
    if (team) {
      await Member.deleteMany({ team: team._id }, { session });
      await Team.deleteOne({ _id: team._id }, { session });
    }

    await Project.deleteOne({ _id: project._id }, { session });
    return project;
  });

  // the files are deleted once the transaction is committed
  await deleteFiles([...project.images, ...project.files]);
};
