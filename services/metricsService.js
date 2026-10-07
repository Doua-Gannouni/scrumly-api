const Sprint = require("../models/sprintModel");
const UserStory = require("../models/userStoryModel");
const sumStoryPoints = require("../utils/sumStoryPoints");
const { ConflictError } = require("../utils/appError");
const { DAY_IN_MS, startOfDay, dayOf, today, formatDay } = require("../utils/dateUtils");

// Scrum metrics : burndown chart of a sprint and velocity of the team

// Burndown chart of the sprint : remaining story points for each day
exports.getBurndown = async (project, id) => {
  const sprint = await Sprint.findInProject(project._id, id);

  // a sprint cancelled before it started has no burndown either
  if (!sprint.startedAt) {
    throw new ConflictError("The burndown chart is available once the sprint has started!");
  }

  const userStories = await UserStory.find({ sprint: sprint._id });
  const totalStoryPoints = sprint.committedStoryPoints;
  const firstDay = startOfDay(sprint.startDate);
  const numberOfDays = Math.round((startOfDay(sprint.endDate) - firstDay) / DAY_IN_MS) + 1;
  const currentDay = today();

  const days = [];
  for (let i = 0; i < numberOfDays; i++) {
    const day = new Date(firstDay.getTime() + i * DAY_IN_MS);
    // a user story counts on the day it was accepted, in the time zone of the users
    const completedStoryPoints = sumStoryPoints(
      userStories.filter((userStory) => userStory.completedAt && dayOf(userStory.completedAt) <= day),
    );

    days.push({
      date: formatDay(day),
      // ideal line : the story points decrease the same way every day
      idealStoryPoints: numberOfDays > 1 ? Math.round(totalStoryPoints * (1 - i / (numberOfDays - 1)) * 100) / 100 : 0,
      // no value for the days in the future
      remainingStoryPoints: day <= currentDay ? totalStoryPoints - completedStoryPoints : null,
    });
  }

  return {
    sprint: {
      _id: sprint._id,
      name: sprint.name,
      status: sprint.status,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
    },
    totalStoryPoints,
    days,
  };
};

// Velocity of the team : story points done in each completed sprint of the project
exports.getVelocity = async (project) => {
  const sprints = await Sprint.find({ project: project._id, status: "Done" }).sort("completedAt");

  // story points done in each sprint, computed in one query (not one query per sprint)
  const donePoints = await UserStory.aggregate([
    { $match: { sprint: { $in: sprints.map((sprint) => sprint._id) }, status: "Done" } },
    { $group: { _id: "$sprint", storyPoints: { $sum: "$storyPoints" } } },
  ]);
  const pointsBySprint = new Map(donePoints.map((item) => [String(item._id), item.storyPoints]));

  const velocity = sprints.map((sprint) => ({
    sprint: sprint._id,
    name: sprint.name,
    committedStoryPoints: sprint.committedStoryPoints,
    completedStoryPoints: pointsBySprint.get(String(sprint._id)) || 0,
  }));

  const totalCompleted = velocity.reduce((total, item) => total + item.completedStoryPoints, 0);
  const averageVelocity = velocity.length ? Math.round((totalCompleted / velocity.length) * 100) / 100 : 0;

  return { sprints: velocity, averageVelocity };
};
