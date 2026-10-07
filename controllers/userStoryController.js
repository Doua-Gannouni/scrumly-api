const userStoryService = require("../services/userStoryService");
const asyncHandler = require("../utils/asyncHandler");

// Create a user story in the product backlog of the project
exports.createUserStory = asyncHandler(async (req, res) => {
  const userStory = await userStoryService.createUserStory(req.project, req.body);
  res.status(201).json({
    status: "success",
    message: "User story created successfully!",
    data: { userStory },
  });
});

// Get all the user stories of the project (ex: ?sprint=<id>&status=Done)
exports.getAllUserStories = asyncHandler(async (req, res) => {
  const { docs: userStories, pagination } = await userStoryService.getAllUserStories(req.project, req.query);
  res.status(200).json({
    status: "success",
    results: userStories.length,
    pagination,
    message: "User stories retrieved successfully!",
    data: { userStories },
  });
});

// Get a user story with its tasks
exports.getUserStoryById = asyncHandler(async (req, res) => {
  const userStory = await userStoryService.getUserStoryById(req.project, req.params.id);
  res.status(200).json({
    status: "success",
    message: "User story retrieved successfully!",
    data: { userStory },
  });
});

// Update a user story
exports.updateUserStory = asyncHandler(async (req, res) => {
  const userStory = await userStoryService.updateUserStory(req.project, req.params.id, req.body);
  res.status(200).json({
    status: "success",
    message: "User story updated successfully!",
    data: { userStory },
  });
});

// The Product Owner accepts a user story (acceptance criteria and Definition of Done met)
exports.acceptUserStory = asyncHandler(async (req, res) => {
  const { userStory, increment } = await userStoryService.acceptUserStory(
    req.project,
    req.params.id,
    req.user.id,
    req.body,
  );
  res.status(200).json({
    status: "success",
    message: "User story accepted, it is part of the increment!",
    data: { userStory, increment },
  });
});

// The Product Owner rejects a user story in review
exports.rejectUserStory = asyncHandler(async (req, res) => {
  const userStory = await userStoryService.rejectUserStory(req.project, req.params.id);
  res.status(200).json({
    status: "success",
    message: "User story rejected, it goes back in progress (add tasks to fix it)!",
    data: { userStory },
  });
});

// Delete a user story with its tasks
exports.deleteUserStory = asyncHandler(async (req, res) => {
  await userStoryService.deleteUserStory(req.project, req.params.id);
  res.status(200).json({
    status: "success",
    message: "User story deleted successfully!",
  });
});
