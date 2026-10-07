const Member = require("../models/memberModel");
const Team = require("../models/teamModel");
const User = require("../models/userModel");
const Task = require("../models/taskModel");
const { SCRUM_TEAM_MAX_SIZE } = require("../constants/scrumRules");
const { BadRequestError, NotFoundError, ConflictError } = require("../utils/appError");
const { runInTransaction, lockDocument } = require("../lib/database");

// Check the role : a Scrum team has only one Product Owner and one Scrum Master
const checkRole = async (teamId, role, memberId, session) => {
  if (!["ProductOwner", "ScrumMaster"].includes(role)) return;

  const filter = { team: teamId, role };
  if (memberId) {
    filter._id = { $ne: memberId };
  }
  if (await Member.findOne(filter, null, { session })) {
    throw new ConflictError(`The team already has a ${role}!`);
  }
};

// Find the team of the project and lock it in the transaction : two simultaneous changes of the members
// of a team are run one after the other, so the checks (size, one Product Owner, one Scrum Master) cannot be bypassed
const lockProjectTeam = async (project, session) => {
  const team = await Team.findOfProject(project._id, session);
  await lockDocument(Team, team._id, session);
  return team;
};

// The user is no longer assigned to the tasks of the project
const unassignTasks = (project, userId, session) =>
  Task.updateMany({ project: project._id, assignedTo: userId }, { assignedTo: null }, { session });

// Get the members of the team of the project with their Scrum role (10 people or fewer)
exports.getMembers = async (project) => {
  const team = await Team.findOfProject(project._id);
  return await Member.find({ team: team._id }).populate("user", "name email type");
};

// Add a user to the team of the project with a Scrum role
exports.addMember = async (project, { user, role, description }) => {
  return await runInTransaction(async (session) => {
    const team = await lockProjectTeam(project, session);

    // a Scrum team is typically 10 or fewer people (Scrum Guide 2020)
    if ((await Member.countDocuments({ team: team._id }).session(session)) >= SCRUM_TEAM_MAX_SIZE) {
      throw new ConflictError(
        `A Scrum team has ${SCRUM_TEAM_MAX_SIZE} or fewer people (Product Owner and Scrum Master included)!`,
      );
    }

    const existingUser = user ? await User.findById(user, null, { session }) : null;
    if (!existingUser) {
      throw new NotFoundError("User not found!");
    }
    if (!existingUser.isActive) {
      throw new ConflictError("This account is not active!");
    }
    // the Scrum role (Product Owner, Scrum Master, Developer) is given here, per project
    if (existingUser.type !== "TeamMember") {
      throw new BadRequestError("Only a team member account can join a Scrum team (not a client or an admin)!");
    }

    await checkRole(team._id, role, null, session);

    try {
      const [member] = await Member.create([{ user, team: team._id, role, description }], { session });
      return member;
    } catch (err) {
      if (err.code === 11000) {
        throw new ConflictError("This user is already a member of the team!");
      }
      throw err;
    }
  });
};

// Update the role or the description of a member of the team of the project
exports.updateMember = async (project, id, { role, description }) => {
  return await runInTransaction(async (session) => {
    const team = await Team.findOfProject(project._id, session);
    const member = await Member.findInTeam(team._id, id, session);

    const oldRole = member.role;
    if (role !== undefined) {
      await lockDocument(Team, team._id, session);
      await checkRole(team._id, role, member._id, session);
      member.role = role;
    }
    if (description !== undefined) {
      member.description = description;
    }

    const updatedMember = await member.save({ session });

    // a member who is no longer a developer is removed from their tasks
    if (oldRole === "Developer" && updatedMember.role !== "Developer") {
      await unassignTasks(project, updatedMember.user, session);
    }
    return updatedMember;
  });
};

// Remove a member from the team of the project (and from their tasks)
exports.deleteMember = async (project, id) => {
  await runInTransaction(async (session) => {
    const team = await Team.findOfProject(project._id, session);
    const member = await Member.findInTeam(team._id, id, session);

    await Member.deleteOne({ _id: member._id }, { session });
    await unassignTasks(project, member.user, session);
  });
};
