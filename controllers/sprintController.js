const sprintService = require("../services/sprintService");
const sprintBacklogService = require("../services/sprintBacklogService");
const metricsService = require("../services/metricsService");
const asyncHandler = require("../utils/asyncHandler");

// Create a sprint (planned)
exports.createSprint = asyncHandler(async (req, res) => {
  const sprint = await sprintService.createSprint(req.project, req.body);
  res.status(201).json({
    status: "success",
    message: "Sprint created successfully!",
    data: { sprint },
  });
});

// Get all the sprints of the project
exports.getAllSprints = asyncHandler(async (req, res) => {
  const { docs: sprints, pagination } = await sprintService.getAllSprints(req.project, req.query);
  res.status(200).json({
    status: "success",
    results: sprints.length,
    pagination,
    message: "Sprints retrieved successfully!",
    data: { sprints },
  });
});

// Get a sprint with its Sprint Backlog, its events and its increments
exports.getSprintById = asyncHandler(async (req, res) => {
  const sprint = await sprintService.getSprintById(req.project, req.params.id);
  res.status(200).json({
    status: "success",
    message: "Sprint retrieved successfully!",
    data: { sprint },
  });
});

// Update a sprint
exports.updateSprint = asyncHandler(async (req, res) => {
  const sprint = await sprintService.updateSprint(req.project, req.params.id, req.body);
  res.status(200).json({
    status: "success",
    message: "Sprint updated successfully!",
    data: { sprint },
  });
});

// Delete a planned sprint
exports.deleteSprint = asyncHandler(async (req, res) => {
  await sprintService.deleteSprint(req.project, req.params.id);
  res.status(200).json({
    status: "success",
    message: "Sprint deleted successfully!",
  });
});

// Start the sprint
exports.startSprint = asyncHandler(async (req, res) => {
  const sprint = await sprintService.startSprint(req.project, req.params.id);
  res.status(200).json({
    status: "success",
    message: "Sprint started successfully!",
    data: { sprint },
  });
});

// Complete the sprint when its time-box expires
exports.completeSprint = asyncHandler(async (req, res) => {
  const { sprint, increments, returnedUserStories } = await sprintService.completeSprint(req.project, req.params.id);
  res.status(200).json({
    status: "success",
    message: `Sprint completed successfully! ${returnedUserStories} unfinished user story(ies) returned to the product backlog.`,
    data: { sprint, increments, returnedUserStories },
  });
});

// Cancel the sprint (Product Owner)
exports.cancelSprint = asyncHandler(async (req, res) => {
  const { sprint, increments, returnedUserStories } = await sprintService.cancelSprint(req.project, req.params.id);
  res.status(200).json({
    status: "success",
    message: `Sprint cancelled successfully! ${returnedUserStories} unfinished user story(ies) returned to the product backlog.`,
    data: { sprint, increments, returnedUserStories },
  });
});

// Sprint Planning : select user stories of the product backlog for the sprint
exports.addUserStories = asyncHandler(async (req, res) => {
  const sprint = await sprintBacklogService.addUserStories(req.project, req.params.id, req.body.userStories);
  res.status(200).json({
    status: "success",
    message: "User stories added to the sprint successfully!",
    data: { sprint },
  });
});

// Remove a user story from the sprint (it goes back to the product backlog)
exports.removeUserStory = asyncHandler(async (req, res) => {
  await sprintBacklogService.removeUserStory(req.project, req.params.id, req.params.userStoryId);
  res.status(200).json({
    status: "success",
    message: "User story removed from the sprint successfully!",
  });
});

// Add an improvement to the Sprint Backlog
exports.addImprovement = asyncHandler(async (req, res) => {
  const improvements = await sprintBacklogService.addImprovement(req.project, req.params.id, req.body.description);
  res.status(201).json({
    status: "success",
    message: "Improvement added to the sprint backlog successfully!",
    data: { improvements },
  });
});

// Update an improvement of the Sprint Backlog (ex: done)
exports.updateImprovement = asyncHandler(async (req, res) => {
  const improvements = await sprintBacklogService.updateImprovement(
    req.project,
    req.params.id,
    req.params.improvementId,
    req.body,
  );
  res.status(200).json({
    status: "success",
    message: "Improvement updated successfully!",
    data: { improvements },
  });
});

// Burndown chart of the sprint
exports.getBurndown = asyncHandler(async (req, res) => {
  const burndown = await metricsService.getBurndown(req.project, req.params.id);
  res.status(200).json({
    status: "success",
    message: "Burndown chart retrieved successfully!",
    data: burndown,
  });
});

// Velocity of the team
exports.getVelocity = asyncHandler(async (req, res) => {
  const velocity = await metricsService.getVelocity(req.project);
  res.status(200).json({
    status: "success",
    results: velocity.sprints.length,
    message: "Velocity retrieved successfully!",
    data: velocity,
  });
});
