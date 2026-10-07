const Team = require("../models/teamModel");
const Member = require("../models/memberModel");
const Task = require("../models/taskModel");
const pickFields = require("../utils/pickFields");
const { ConflictError } = require("../utils/appError");
const { runInTransaction } = require("../lib/database");

// Create the Scrum team of the project (one team per project)
exports.createTeam = async (project, { name, description }) => {
  if (await Team.exists({ project: project._id })) {
    throw new ConflictError("This project already has a team!");
  }
  return await Team.create({ name, description, project: project._id });
};

// Get the team of the project with its members
exports.getTeam = async (project) => {
  const team = await Team.findOfProject(project._id);
  return await team.populate({ path: "members", populate: { path: "user", select: "name email type" } });
};

// Update the team of the project (name and description)
exports.updateTeam = async (project, body) => {
  const team = await Team.findOfProject(project._id);
  team.set(pickFields(body, ["name", "description"]));
  return await team.save();
};

// Delete the team of the project with its members (the tasks of the project are no longer assigned)
exports.deleteTeam = async (project) => {
  await runInTransaction(async (session) => {
    const team = await Team.findOfProject(project._id, session);

    await Member.deleteMany({ team: team._id }, { session });
    await Task.updateMany({ project: project._id }, { assignedTo: null }, { session });
    await Team.deleteOne({ _id: team._id }, { session });
  });
};
