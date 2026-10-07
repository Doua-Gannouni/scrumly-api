const Sprint = require("../models/sprintModel");
const UserStory = require("../models/userStoryModel");
const pickFields = require("../utils/pickFields");
const sumStoryPoints = require("../utils/sumStoryPoints");
const { NotFoundError, ConflictError } = require("../utils/appError");
const { runInTransaction } = require("../lib/database");
const { requireList } = require("../utils/validation");

// Sprint Backlog of a sprint : the user stories selected for the sprint and the improvements (Scrum Guide)

// Sprint Planning : the Developers select user stories of the product backlog with the Product Owner
exports.addUserStories = async (project, id, userStories) => {
  requireList(userStories, "user stories (userStories)");

  await runInTransaction(async (session) => {
    const sprint = await Sprint.findInProject(project._id, id, session);

    if (!["Planned", "In progress"].includes(sprint.status)) {
      throw new ConflictError("User stories can only be added to a planned or in progress sprint!");
    }

    // the user stories must be in the product backlog of the project, not done and not in a sprint
    const selectedUserStories = await UserStory.find(
      {
        _id: { $in: userStories },
        productBacklog: project.productBacklog,
        sprint: null,
        status: { $ne: "Done" },
      },
      null,
      { session },
    );
    if (selectedUserStories.length !== new Set(userStories.map(String)).size) {
      throw new ConflictError(
        "Some user stories do not exist in the product backlog, are already in a sprint or are done!",
      );
    }

    await UserStory.updateMany(
      { _id: { $in: selectedUserStories.map((userStory) => userStory._id) } },
      { sprint: sprint._id },
      { session },
    );

    // the sprint has already started : the commitment increases
    if (sprint.status === "In progress") {
      sprint.committedStoryPoints += sumStoryPoints(selectedUserStories);
      await sprint.save({ session });
    }
  });

  return await Sprint.findById(id).populate("userStories");
};

// Remove a user story from the sprint (it goes back to the product backlog)
exports.removeUserStory = async (project, id, userStoryId) => {
  await runInTransaction(async (session) => {
    const sprint = await Sprint.findInProject(project._id, id, session);

    if (!["Planned", "In progress"].includes(sprint.status)) {
      throw new ConflictError("User stories can only be removed from a planned or in progress sprint!");
    }

    const userStory = await UserStory.findOne({ _id: userStoryId, sprint: sprint._id }, null, { session });
    if (!userStory) {
      throw new NotFoundError("User story not found in this sprint!");
    }
    if (userStory.status === "Done") {
      throw new ConflictError("A done user story cannot be removed from the sprint!");
    }

    userStory.sprint = null;
    await userStory.save({ session });

    if (sprint.status === "In progress") {
      sprint.committedStoryPoints = Math.max(sprint.committedStoryPoints - (userStory.storyPoints || 0), 0);
      await sprint.save({ session });
    }
  });
};

// The Developers add an improvement to the Sprint Backlog
exports.addImprovement = async (project, id, description) => {
  const sprint = await Sprint.findInProject(project._id, id);

  if (!["Planned", "In progress"].includes(sprint.status)) {
    throw new ConflictError("Improvements can only be added to a planned or in progress sprint!");
  }

  sprint.improvements.push({ description });
  const updatedSprint = await sprint.save();
  return updatedSprint.improvements;
};

// The Developers update an improvement of the Sprint Backlog (ex: done)
exports.updateImprovement = async (project, id, improvementId, body) => {
  const sprint = await Sprint.findInProject(project._id, id);

  if (["Done", "Cancelled"].includes(sprint.status)) {
    throw new ConflictError("The improvements of a finished sprint cannot be modified!");
  }

  const improvement = sprint.improvements.id(improvementId);
  if (!improvement) {
    throw new NotFoundError("Improvement not found!");
  }

  improvement.set(pickFields(body, ["description", "done"]));
  const updatedSprint = await sprint.save();
  return updatedSprint.improvements;
};
