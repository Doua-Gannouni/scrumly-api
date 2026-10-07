const UserStory = require("../models/userStoryModel");
const ProductBacklog = require("../models/productBacklogModel");
const Sprint = require("../models/sprintModel");
const Task = require("../models/taskModel");
const Increment = require("../models/incrementModel");
const ApiFeatures = require("../utils/apiFeatures");
const pickFields = require("../utils/pickFields");
const { BadRequestError, ConflictError } = require("../utils/appError");
const { runInTransaction, lockDocument } = require("../lib/database");

const USER_STORY_FIELDS = ["title", "description", "acceptanceCriteria", "priority", "storyPoints"];

// Position asked for a user story in the product backlog (priority, 1 = first), undefined if not given
const readPosition = (priority) => {
  if (priority === undefined || priority === null) return undefined;
  const position = Number(priority);
  if (!Number.isInteger(position) || position < 1) {
    throw new BadRequestError("Priority must be an integer of 1 or more (1 = first of the product backlog)!");
  }
  return position;
};

// Order of the product backlog : the user stories not done have distinct priorities 1, 2, 3 ...
// the moved user story takes the given position (the last one when no position is given) and the others follow
// the product backlog is locked in the transaction : two simultaneous changes cannot give the same priority
const orderProductBacklog = async (productBacklogId, session, movedUserStory = null, position = undefined) => {
  await lockDocument(ProductBacklog, productBacklogId, session);

  const userStories = await UserStory.find(
    {
      productBacklog: productBacklogId,
      status: { $ne: "Done" },
      ...(movedUserStory ? { _id: { $ne: movedUserStory._id } } : {}),
    },
    null,
    { session },
  ).sort("priority createdAt");

  if (movedUserStory) {
    const index = position === undefined ? userStories.length : Math.min(position - 1, userStories.length);
    userStories.splice(index, 0, movedUserStory);
  }

  const changes = userStories
    .map((userStory, index) => ({ userStory, priority: index + 1 }))
    .filter(({ userStory, priority }) => userStory.priority !== priority)
    .map(({ userStory, priority }) => ({
      updateOne: { filter: { _id: userStory._id }, update: { $set: { priority } } },
    }));
  if (changes.length) {
    await UserStory.bulkWrite(changes, { session });
  }
};

// The moment a user story meets the Definition of Done, an Increment is born (Scrum Guide)
// it is added to the current increment of the sprint, or to a new one if the last one was delivered
const addToIncrement = async (project, sprint, userStory, session) => {
  let increment = await Increment.findOne({ sprint: sprint._id, delivered: false }, null, { session });

  if (!increment) {
    const numberOfIncrements = await Increment.countDocuments({ sprint: sprint._id }).session(session);
    increment = new Increment({
      name: `Increment ${numberOfIncrements + 1} - ${sprint.name}`,
      sprint: sprint._id,
      project: project._id,
      userStories: [],
      storyPoints: 0,
      definitionOfDone: project.definitionOfDone,
    });
  }

  increment.userStories.push(userStory._id);
  increment.storyPoints += userStory.storyPoints || 0;
  return await increment.save({ session });
};

// Create a user story in the product backlog of the project (the status is not settable)
// the priority is its position in the product backlog (the last one by default)
exports.createUserStory = async (project, body) => {
  const { priority, ...fields } = pickFields(body, USER_STORY_FIELDS);
  const position = readPosition(priority);

  return await runInTransaction(async (session) => {
    const [userStory] = await UserStory.create(
      [
        {
          ...fields,
          priority: 1, // final position given by orderProductBacklog
          productBacklog: project.productBacklog,
        },
      ],
      { session },
    );

    await orderProductBacklog(project.productBacklog, session, userStory, position);
    return await UserStory.findById(userStory._id, null, { session });
  });
};

// Get all the user stories of the project (ex: ?sprint=<id>&status=Done)
exports.getAllUserStories = async (project, query) => {
  const features = new ApiFeatures(
    UserStory.find({ productBacklog: project.productBacklog }).populate("sprint", "name status"),
    query,
    "priority",
  )
    .filter()
    .pagination()
    .sort();

  return await features.execute();
};

// Get a user story with its tasks
exports.getUserStoryById = async (project, id) => {
  const userStory = await UserStory.findInBacklog(project.productBacklog, id);
  return await userStory.populate([
    { path: "tasks", populate: { path: "assignedTo", select: "name email" } },
    { path: "sprint", select: "name status goal" },
    { path: "acceptedBy", select: "name email" },
  ]);
};

// Update a user story (the status follows the tasks and the acceptance, the sprint is changed with the sprint routes)
exports.updateUserStory = async (project, id, body) => {
  return await runInTransaction(async (session) => {
    const userStory = await UserStory.findInBacklog(project.productBacklog, id, session);

    if (userStory.status === "Done") {
      throw new ConflictError("A done user story cannot be modified (it is part of an increment)!");
    }

    // a new priority moves the user story in the product backlog (the others follow)
    const { priority, ...fields } = pickFields(body, USER_STORY_FIELDS);
    const position = readPosition(priority);

    const oldStoryPoints = userStory.storyPoints;
    userStory.set(fields);
    let updatedUserStory = await userStory.save({ session });
    if (position !== undefined) {
      await orderProductBacklog(project.productBacklog, session, updatedUserStory, position);
      updatedUserStory = await UserStory.findById(updatedUserStory._id, null, { session });
    }

    // new estimate of a user story of the sprint in progress : the commitment follows (burndown chart)
    const difference = updatedUserStory.storyPoints - oldStoryPoints;
    if (updatedUserStory.sprint && difference !== 0) {
      await Sprint.updateOne(
        { _id: updatedUserStory.sprint, status: "In progress" },
        { $inc: { committedStoryPoints: difference } },
        { session },
      );
    }
    return updatedUserStory;
  });
};

// The Product Owner accepts a user story : its acceptance criteria and the Definition of Done are met
// the user story and its increment are saved together
exports.acceptUserStory = async (project, id, productOwnerId, { acceptanceCriteriaMet, definitionOfDoneMet }) => {
  return await runInTransaction(async (session) => {
    const userStory = await UserStory.findInBacklog(project.productBacklog, id, session);

    if (userStory.status === "Done") {
      throw new ConflictError("This user story is already done!");
    }
    // the Product Owner checks the user story once the Developers have done all its tasks
    if (userStory.status !== "In review") {
      throw new ConflictError("Only a user story in review (all its tasks done) can be accepted!");
    }

    const sprint = userStory.sprint ? await Sprint.findById(userStory.sprint, null, { session }) : null;
    if (!sprint || sprint.status !== "In progress") {
      throw new ConflictError("Only a user story of the sprint in progress can be accepted!");
    }

    const tasks = await Task.find({ userStory: userStory._id }, null, { session });
    if (tasks.some((task) => task.status !== "Done")) {
      throw new ConflictError("All the tasks of the user story must be done!");
    }

    if (acceptanceCriteriaMet !== true || definitionOfDoneMet !== true) {
      throw new BadRequestError(
        "The Product Owner must confirm that the acceptance criteria (acceptanceCriteriaMet) and the Definition of Done (definitionOfDoneMet) are met!",
      );
    }

    userStory.status = "Done";
    userStory.acceptedBy = productOwnerId;
    const acceptedUserStory = await userStory.save({ session });

    // two acceptances at the same time are run one after the other : they share the same open increment
    await lockDocument(Sprint, sprint._id, session);
    const increment = await addToIncrement(project, sprint, acceptedUserStory, session);
    return { userStory: acceptedUserStory, increment };
  });
};

// The Product Owner rejects a user story in review : it goes back in progress
exports.rejectUserStory = async (project, id) => {
  const userStory = await UserStory.findInBacklog(project.productBacklog, id);

  if (userStory.status !== "In review") {
    throw new ConflictError("Only a user story in review can be rejected!");
  }

  userStory.status = "In progress";
  return await userStory.save();
};

// Delete a user story with its tasks
exports.deleteUserStory = async (project, id) => {
  await runInTransaction(async (session) => {
    const userStory = await UserStory.findInBacklog(project.productBacklog, id, session);

    if (await Increment.findOne({ userStories: userStory._id }, null, { session })) {
      throw new ConflictError("A user story included in an increment cannot be deleted!");
    }
    if (userStory.sprint) {
      throw new ConflictError("Remove the user story from its sprint before deleting it!");
    }

    await Task.deleteMany({ userStory: userStory._id }, { session });
    await UserStory.deleteOne({ _id: userStory._id }, { session });
    // the next user stories move up (no gap in the priorities)
    await orderProductBacklog(project.productBacklog, session);
  });
};
