const taskService = require("../services/taskService");
const asyncHandler = require("../utils/asyncHandler");

// Create a task for a user story
exports.createTask = asyncHandler(async (req, res) => {
  const task = await taskService.createTask(req.project, req.body);
  res.status(201).json({
    status: "success",
    message: "Task created successfully!",
    data: { task },
  });
});

// Get all the tasks of the project (ex: ?status=To do&assignedTo=<id>)
exports.getAllTasks = asyncHandler(async (req, res) => {
  const { docs: tasks, pagination } = await taskService.getAllTasks(req.project, req.query);
  res.status(200).json({
    status: "success",
    results: tasks.length,
    pagination,
    message: "Tasks retrieved successfully!",
    data: { tasks },
  });
});

// Get the tasks of the project assigned to the logged-in user
exports.getMyTasks = asyncHandler(async (req, res) => {
  const { docs: tasks, pagination } = await taskService.getMyTasks(req.project, req.user.id, req.query);
  res.status(200).json({
    status: "success",
    results: tasks.length,
    pagination,
    message: "Tasks retrieved successfully!",
    data: { tasks },
  });
});

// Get a task by ID
exports.getTaskById = asyncHandler(async (req, res) => {
  const task = await taskService.getTaskById(req.project, req.params.id);
  res.status(200).json({
    status: "success",
    message: "Task retrieved successfully!",
    data: { task },
  });
});

// Update a task (status, assignment, user story ...)
exports.updateTask = asyncHandler(async (req, res) => {
  const task = await taskService.updateTask(req.project, req.params.id, req.body);
  res.status(200).json({
    status: "success",
    message: "Task updated successfully!",
    data: { task },
  });
});

// Delete a task
exports.deleteTask = asyncHandler(async (req, res) => {
  await taskService.deleteTask(req.project, req.params.id);
  res.status(200).json({
    status: "success",
    message: "Task deleted successfully!",
  });
});
