const Task = require("../models/taskModel");
const UserStory = require("../models/userStoryModel");
const Team = require("../models/teamModel");
const Member = require("../models/memberModel");
const ApiFeatures = require("../utils/apiFeatures");
const pickFields = require("../utils/pickFields");
const { BadRequestError, ConflictError } = require("../utils/appError");
const { runInTransaction } = require("../lib/database");

const TASK_FIELDS = ["name", "description", "estimatedHours", "status", "userStory", "assignedTo"];

// Check that the user story belongs to the project and is not done (part of an increment)
const checkUserStory = async (project, userStoryId, session) => {
  if (!userStoryId) {
    throw new BadRequestError("User story is required!");
  }

  const userStory = await UserStory.findInBacklog(project.productBacklog, userStoryId, session);
  if (userStory.status === "Done") {
    throw new ConflictError("The tasks of a done user story cannot be modified!");
  }
  return userStory;
};

// The tasks are the plan of the Developers for the user stories selected in a sprint (Sprint Backlog) :
// a task is only added to a user story of a sprint
const checkUserStoryInSprint = async (project, userStoryId, session) => {
  const userStory = await checkUserStory(project, userStoryId, session);
  if (!userStory.sprint) {
    throw new ConflictError("Select the user story in a sprint before planning its tasks!");
  }
};

// Check that the task is assigned to a Developer of the project team
const checkAssignee = async (project, userId, session) => {
  if (!userId) return;

  const team = await Team.findOne({ project: project._id }, null, { session });
  const member = team
    ? await Member.findOne({ team: team._id, user: userId, role: "Developer" }, null, { session })
    : null;
  if (!member) {
    throw new BadRequestError("A task must be assigned to a Developer of the project team!");
  }
};

// Update the status of the user story from the status of its tasks
// (a user story without tasks is "To do" : it cannot stay in review and be accepted with no task)
const updateUserStoryStatus = async (userStoryId, session) => {
  const userStory = await UserStory.findById(userStoryId, null, { session });
  if (!userStory || userStory.status === "Done") return;
  const tasks = await Task.find({ userStory: userStoryId }, null, { session });

  let status = "To do";
  if (tasks.length && tasks.every((task) => task.status === "Done")) {
    // all the tasks are done : the Product Owner must now check the Definition of Done
    status = "In review";
  } else if (tasks.some((task) => task.status !== "To do")) {
    status = "In progress";
  }

  if (userStory.status !== status) {
    userStory.status = status;
    await userStory.save({ session });
  }
};

// Create a task for a user story (the task and the status of the user story are saved together)
exports.createTask = async (project, body) => {
  const fields = pickFields(body, TASK_FIELDS);

  return await runInTransaction(async (session) => {
    await checkUserStoryInSprint(project, fields.userStory, session);
    await checkAssignee(project, fields.assignedTo, session);

    const [newTask] = await Task.create([{ ...fields, project: project._id }], { session });
    await updateUserStoryStatus(newTask.userStory, session);
    return newTask;
  });
};

// Get all the tasks of the project (ex: ?status=To do&assignedTo=<id>)
exports.getAllTasks = async (project, query) => {
  const features = new ApiFeatures(
    Task.find({ project: project._id }).populate("assignedTo", "name email").populate("userStory", "title sprint"),
    query,
  )
    .filter()
    .pagination()
    .sort();

  return await features.execute();
};

// Get the tasks of the project assigned to the user
exports.getMyTasks = async (project, userId, query) => {
  const features = new ApiFeatures(
    Task.find({ project: project._id, assignedTo: userId }).populate("userStory", "title sprint"),
    query,
  )
    .filter()
    .pagination()
    .sort();

  return await features.execute();
};

// Get a task by ID
exports.getTaskById = async (project, id) => {
  const task = await Task.findInProject(project._id, id);
  return await task.populate([{ path: "userStory" }, { path: "assignedTo", select: "name email" }]);
};

// Update a task (status, assignment, user story ...)
exports.updateTask = async (project, id, body) => {
  const fields = pickFields(body, TASK_FIELDS);

  return await runInTransaction(async (session) => {
    const task = await Task.findInProject(project._id, id, session);

    await checkUserStory(project, task.userStory, session);
    if (fields.userStory !== undefined) {
      await checkUserStoryInSprint(project, fields.userStory, session);
    }
    await checkAssignee(project, fields.assignedTo, session);

    const oldUserStory = task.userStory;
    task.set(fields);
    const statusChanged = task.isModified("status");
    const updatedTask = await task.save({ session });
    const moved = String(oldUserStory) !== String(updatedTask.userStory);

    // the status of the user story follows its tasks : only a change of status (or of user story) updates it,
    // so editing a task (ex: its description) does not cancel a rejection of the Product Owner
    if (statusChanged || moved) {
      await updateUserStoryStatus(updatedTask.userStory, session);
    }
    if (moved) {
      await updateUserStoryStatus(oldUserStory, session);
    }
    return updatedTask;
  });
};

// Delete a task
exports.deleteTask = async (project, id) => {
  await runInTransaction(async (session) => {
    const task = await Task.findInProject(project._id, id, session);

    await checkUserStory(project, task.userStory, session);

    await Task.deleteOne({ _id: task._id }, { session });
    await updateUserStoryStatus(task.userStory, session);
  });
};
