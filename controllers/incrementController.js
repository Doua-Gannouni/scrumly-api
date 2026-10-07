const incrementService = require("../services/incrementService");
const asyncHandler = require("../utils/asyncHandler");

// Get all the increments of the project
exports.getAllIncrements = asyncHandler(async (req, res) => {
  const { docs: increments, pagination } = await incrementService.getAllIncrements(req.project, req.query);
  res.status(200).json({
    status: "success",
    results: increments.length,
    pagination,
    message: "Increments retrieved successfully!",
    data: { increments },
  });
});

// Get an increment with its user stories
exports.getIncrementById = asyncHandler(async (req, res) => {
  const increment = await incrementService.getIncrementById(req.project, req.params.id);
  res.status(200).json({
    status: "success",
    message: "Increment retrieved successfully!",
    data: { increment },
  });
});

// Update the name or the description of an increment
exports.updateIncrement = asyncHandler(async (req, res) => {
  const increment = await incrementService.updateIncrement(req.project, req.params.id, req.body);
  res.status(200).json({
    status: "success",
    message: "Increment updated successfully!",
    data: { increment },
  });
});

// The Product Owner delivers the increment to the stakeholders
exports.deliverIncrement = asyncHandler(async (req, res) => {
  const increment = await incrementService.deliverIncrement(req.project, req.params.id);
  res.status(200).json({
    status: "success",
    message: "Increment delivered to the stakeholders successfully!",
    data: { increment },
  });
});
