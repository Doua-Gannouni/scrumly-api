const Sprint = require("../models/sprintModel");
const UserStory = require("../models/userStoryModel");
const ScrumEvent = require("../models/scrumEventModel");
const Increment = require("../models/incrementModel");
const Notification = require("../models/notificationModel");
const Team = require("../models/teamModel");
const Member = require("../models/memberModel");
const ApiFeatures = require("../utils/apiFeatures");
const pickFields = require("../utils/pickFields");
const { BadRequestError, ConflictError } = require("../utils/appError");
const { runInTransaction } = require("../lib/database");
const sumStoryPoints = require("../utils/sumStoryPoints");
const { startOfDay, dayOf, today, nextDay, formatDay } = require("../utils/dateUtils");

// Lifecycle of the sprints : planning, start, completion, cancellation (rules of the Scrum Guide)
// the Sprint Backlog is in sprintBacklogService.js, the burndown and the velocity in metricsService.js

// Sprints of the sequence of the project, ordered by date (a sprint cancelled before starting is ignored)
const getSequenceSprints = (projectId, excludedId, session) =>
  Sprint.find(
    {
      project: projectId,
      _id: { $ne: excludedId },
      $or: [{ status: { $ne: "Cancelled" } }, { startedAt: { $ne: null } }],
    },
    null,
    { session },
  ).sort("startDate");

// Previous sprint of the sequence (the last one before the given sprint)
const getPreviousSprint = async (projectId, sprint, session) => {
  const otherSprints = await getSequenceSprints(projectId, sprint._id, session);
  return otherSprints.filter((otherSprint) => otherSprint.endDate < sprint.startDate).pop() || null;
};

// First day allowed for a new sprint after the given previous sprint :
// a new Sprint starts immediately after the conclusion of the previous Sprint (Scrum Guide),
// but after a pause (the previous sprint is over and the day after it is already past) the team restarts from today
const getRestartDay = (previousSprint) => {
  const expectedStart = nextDay(previousSprint.endDate);
  const isOver = ["Done", "Cancelled"].includes(previousSprint.status);
  return isOver && expectedStart < today() ? today() : null;
};

// Check the sprint dates : inside the project dates, no overlap,
// and a new Sprint starts immediately after the conclusion of the previous Sprint (or from today after a pause)
const checkSprintDates = async (project, sprint) => {
  if (sprint.startDate < project.startDate || sprint.endDate > project.endDate) {
    throw new BadRequestError("The sprint must be inside the project dates!");
  }

  const otherSprints = await getSequenceSprints(project._id, sprint._id);

  const overlappingSprint = otherSprints.find(
    (otherSprint) => otherSprint.startDate <= sprint.endDate && otherSprint.endDate >= sprint.startDate,
  );
  if (overlappingSprint) {
    throw new ConflictError(`The sprint overlaps the sprint "${overlappingSprint.name}"!`);
  }

  if (otherSprints.some((otherSprint) => otherSprint.startDate > sprint.endDate)) {
    throw new ConflictError("Sprints are consecutive : only the last sprint of the project can be planned or moved!");
  }

  const previousSprint = otherSprints[otherSprints.length - 1];
  if (previousSprint) {
    const startDay = startOfDay(sprint.startDate);
    const expectedStart = nextDay(previousSprint.endDate);
    const restartDay = getRestartDay(previousSprint);
    const isConsecutive = startDay.getTime() === expectedStart.getTime();
    const isRestart = restartDay && startDay >= restartDay;
    if (!isConsecutive && !isRestart) {
      throw new ConflictError(
        restartDay
          ? `After a pause, a new sprint starts on ${formatDay(expectedStart)} (right after the previous one) or from today (${formatDay(restartDay)})!`
          : `A new sprint starts immediately after the previous one : the start date must be ${formatDay(expectedStart)}!`,
      );
    }
  }
};

// The events of a sprint stay inside its dates, and the Sprint Planning on its first day (checked when the dates change)
const checkEventsInsideSprint = async (sprint) => {
  const firstDay = startOfDay(sprint.startDate);
  const lastDay = startOfDay(sprint.endDate);
  const events = await ScrumEvent.find({ sprint: sprint._id });
  const misplacedEvent = events.find((event) => {
    const eventDay = dayOf(event.date);
    return (
      eventDay < firstDay ||
      eventDay > lastDay ||
      (event.type === "SprintPlanning" && eventDay.getTime() !== firstDay.getTime())
    );
  });
  if (misplacedEvent) {
    throw new ConflictError(
      `With these dates, the ${misplacedEvent.type} of ${formatDay(dayOf(misplacedEvent.date))} would no longer fit in the sprint (the Sprint Planning is on the first day) : move or delete it first!`,
    );
  }
};

// Check the Scrum team : one Product Owner, one Scrum Master and at least one Developer
const checkScrumTeam = async (project) => {
  const team = await Team.findOne({ project: project._id });
  const members = team ? await Member.find({ team: team._id }) : [];
  const roles = members.map((member) => member.role);

  if (!roles.includes("ProductOwner") || !roles.includes("ScrumMaster") || !roles.includes("Developer")) {
    throw new ConflictError("The Scrum team must have a Product Owner, a Scrum Master and at least one Developer!");
  }
};

// Add the improvements of the previous Sprint Retrospective to the Sprint Backlog
// done when the sprint is created and again when it starts : the improvements added to the retrospective
// in between are not lost, and the ones already imported are not added twice
const importRetrospectiveImprovements = async (projectId, sprint) => {
  const previousSprint = await getPreviousSprint(projectId, sprint);
  if (!previousSprint) return;

  const retrospective = await ScrumEvent.findOne({ sprint: previousSprint._id, type: "SprintRetrospective" });
  if (!retrospective) return;

  const imported = new Set(
    sprint.improvements
      .filter((improvement) => improvement.fromRetrospective)
      .map((improvement) => improvement.description),
  );
  retrospective.improvements
    .filter((description) => !imported.has(description))
    .forEach((description) => sprint.improvements.push({ description, fromRetrospective: true }));
};

// Move the following planned sprints so that the sprints stay consecutive (after a cancellation)
// they never move before today : a sprint planned in the past could never be started
const moveFollowingSprints = async (project, conclusionDate, session) => {
  const followingSprints = await Sprint.find(
    {
      project: project._id,
      status: "Planned",
      startDate: { $gt: conclusionDate },
    },
    null,
    { session },
  ).sort("startDate");

  let expectedStart = nextDay(conclusionDate) < today() ? today() : nextDay(conclusionDate);
  for (const followingSprint of followingSprints) {
    const shift = expectedStart.getTime() - startOfDay(followingSprint.startDate).getTime();
    if (shift !== 0) {
      followingSprint.startDate = new Date(followingSprint.startDate.getTime() + shift);
      followingSprint.endDate = new Date(followingSprint.endDate.getTime() + shift);
      if (followingSprint.endDate > project.endDate) {
        throw new ConflictError(
          `The sprint "${followingSprint.name}" cannot follow inside the project dates : delete it or change the project dates first!`,
        );
      }
      await followingSprint.save({ session });

      // the events of the sprint move with it
      const events = await ScrumEvent.find({ sprint: followingSprint._id }, null, { session });
      for (const event of events) {
        event.date = new Date(event.date.getTime() + shift);
        await event.save({ session });
      }
    }
    expectedStart = nextDay(followingSprint.endDate);
  }
};

// Close the sprint : the user stories that are not done go back to the product backlog
// they keep the status given by their tasks (ex: a user story in review can be accepted in a next sprint)
const closeSprint = async (sprint, status, session) => {
  const unfinishedUserStories = await UserStory.find({ sprint: sprint._id, status: { $ne: "Done" } }, null, {
    session,
  });

  await UserStory.updateMany(
    { _id: { $in: unfinishedUserStories.map((userStory) => userStory._id) } },
    { sprint: null },
    { session },
  );

  sprint.status = status;
  sprint.completedAt = Date.now();
  await sprint.save({ session });

  return unfinishedUserStories.length;
};

// Translate the duplicate key errors of a sprint (unique name in the project, one sprint in progress)
const saveSprint = async (sprint) => {
  try {
    return await sprint.save();
  } catch (err) {
    if (err.code === 11000) {
      throw new ConflictError(
        err.keyPattern && err.keyPattern.name
          ? "A sprint with this name already exists in the project!"
          : "Another sprint is already in progress in the project!",
      );
    }
    throw err;
  }
};

// Create a sprint (planned)
exports.createSprint = async (project, body) => {
  const sprint = new Sprint({
    ...pickFields(body, ["name", "description", "goal", "startDate", "endDate"]),
    project: project._id,
  });

  await sprint.validate();
  await checkSprintDates(project, sprint);
  await importRetrospectiveImprovements(project._id, sprint);

  return await saveSprint(sprint);
};

// Get all the sprints of the project
exports.getAllSprints = async (project, query) => {
  const features = new ApiFeatures(Sprint.find({ project: project._id }), query, "startDate")
    .filter()
    .pagination()
    .sort();

  return await features.execute();
};

// Get a sprint with its Sprint Backlog (Sprint Goal, user stories, tasks, improvements), its events and its increments
exports.getSprintById = async (project, id) => {
  const sprint = await Sprint.findInProject(project._id, id);
  return await sprint.populate([
    { path: "userStories", populate: { path: "tasks", populate: { path: "assignedTo", select: "name email" } } },
    { path: "events" },
    { path: "increments" },
  ]);
};

// Update a sprint (during the sprint the Sprint Goal and the dates do not change, Scrum Guide)
exports.updateSprint = async (project, id, body) => {
  const sprint = await Sprint.findInProject(project._id, id);

  if (["Done", "Cancelled"].includes(sprint.status)) {
    throw new ConflictError("A finished sprint cannot be modified!");
  }

  const fixedFields = ["goal", "startDate", "endDate"];
  if (sprint.status === "In progress" && fixedFields.some((field) => body[field] !== undefined)) {
    throw new ConflictError("The Sprint Goal and the dates cannot change during the sprint!");
  }

  sprint.set(pickFields(body, ["name", "description", ...fixedFields]));
  await sprint.validate();

  if (sprint.isModified("startDate") || sprint.isModified("endDate")) {
    await checkSprintDates(project, sprint);
    await checkEventsInsideSprint(sprint);
  }

  return await saveSprint(sprint);
};

// Delete a planned sprint (only the last one, the sprints stay consecutive)
exports.deleteSprint = async (project, id) => {
  await runInTransaction(async (session) => {
    const sprint = await Sprint.findInProject(project._id, id, session);

    if (sprint.status !== "Planned") {
      throw new ConflictError("Only a planned sprint can be deleted!");
    }

    const otherSprints = await getSequenceSprints(project._id, sprint._id, session);
    if (otherSprints.some((otherSprint) => otherSprint.startDate > sprint.endDate)) {
      throw new ConflictError("Sprints are consecutive : only the last sprint of the project can be deleted!");
    }

    await UserStory.updateMany({ sprint: sprint._id }, { sprint: null }, { session });
    await ScrumEvent.deleteMany({ sprint: sprint._id }, { session });
    await Notification.updateMany({ sprint: sprint._id }, { sprint: null }, { session });
    await Sprint.deleteOne({ _id: sprint._id }, { session });
  });
};

// Start the sprint (Sprint Planning initiates the Sprint)
exports.startSprint = async (project, id) => {
  const sprint = await Sprint.findInProject(project._id, id);

  if (sprint.status !== "Planned") {
    throw new ConflictError("Only a planned sprint can be started!");
  }
  if (!sprint.goal) {
    throw new ConflictError("The sprint needs a Sprint Goal before starting!");
  }

  // only one sprint in progress at a time in a project
  const activeSprint = await Sprint.findOne({ project: project._id, status: "In progress" });
  if (activeSprint) {
    throw new ConflictError(`The sprint "${activeSprint.name}" is already in progress!`);
  }

  // the sprints follow each other : an earlier sprint never started (its user stories are not in the backlog)
  // must be started or cancelled first
  const earlierPlannedSprint = await Sprint.findOne({
    project: project._id,
    status: "Planned",
    startDate: { $lt: sprint.startDate },
  });
  if (earlierPlannedSprint) {
    throw new ConflictError(
      `The sprint "${earlierPlannedSprint.name}" planned before this one must be started or cancelled first!`,
    );
  }

  // the sprint starts during its planned dates (current day in the time zone of the users)
  const currentDay = today();
  if (currentDay < startOfDay(sprint.startDate) || currentDay > startOfDay(sprint.endDate)) {
    throw new ConflictError(
      `The sprint can only start between ${formatDay(sprint.startDate)} and ${formatDay(sprint.endDate)}!`,
    );
  }

  const userStories = await UserStory.find({ sprint: sprint._id });
  if (!userStories.length) {
    throw new ConflictError("Select at least one user story before starting the sprint!");
  }

  await checkScrumTeam(project);
  await importRetrospectiveImprovements(project._id, sprint);

  sprint.status = "In progress";
  sprint.startedAt = Date.now();
  sprint.committedStoryPoints = sumStoryPoints(userStories);
  return await saveSprint(sprint);
};

// Complete the sprint when its time-box expires (Sprints are fixed length events, Scrum Guide)
exports.completeSprint = async (project, id) => {
  return await runInTransaction(async (session) => {
    const sprint = await Sprint.findInProject(project._id, id, session);

    if (sprint.status !== "In progress") {
      throw new ConflictError("Only a sprint in progress can be completed!");
    }
    if (today() < startOfDay(sprint.endDate)) {
      throw new ConflictError(
        `The sprint ends on ${formatDay(sprint.endDate)} : it can be completed from this date (or cancelled by the Product Owner)!`,
      );
    }

    const returnedUserStories = await closeSprint(sprint, "Done", session);
    const increments = await Increment.find({ sprint: sprint._id }, null, { session });

    return { sprint, increments, returnedUserStories };
  });
};

// Cancel the sprint (only the Product Owner can cancel a sprint, Scrum Guide)
exports.cancelSprint = async (project, id) => {
  return await runInTransaction(async (session) => {
    const sprint = await Sprint.findInProject(project._id, id, session);

    if (!["Planned", "In progress"].includes(sprint.status)) {
      throw new ConflictError("Only a planned or in progress sprint can be cancelled!");
    }

    const wasStarted = sprint.status === "In progress";
    const returnedUserStories = await closeSprint(sprint, "Cancelled", session);

    // conclusion of the sprint : the day of the cancellation (started sprint) or the end of the previous sprint
    let conclusionDate = null;
    if (wasStarted) {
      const currentDay = today();
      if (currentDay < startOfDay(sprint.endDate)) {
        sprint.endDate = currentDay > sprint.startDate ? currentDay : sprint.startDate;
        await sprint.save({ session });
      }
      conclusionDate = sprint.endDate;
    } else {
      const previousSprint = await getPreviousSprint(project._id, sprint, session);
      conclusionDate = previousSprint ? previousSprint.endDate : null;
    }

    // the next sprint starts immediately after the conclusion of this sprint
    if (conclusionDate) {
      await moveFollowingSprints(project, conclusionDate, session);
    }

    const increments = await Increment.find({ sprint: sprint._id }, null, { session });
    return { sprint, increments, returnedUserStories };
  });
};
