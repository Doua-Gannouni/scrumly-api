const teamService = require("../services/teamService");
const asyncHandler = require("../utils/asyncHandler");

// Create the Scrum team of the project
exports.createTeam = asyncHandler(async (req, res) => {
  const team = await teamService.createTeam(req.project, req.body);
  res.status(201).json({
    status: "success",
    message: "Team created successfully!",
    data: { team },
  });
});

// Get the team of the project with its members
exports.getTeam = asyncHandler(async (req, res) => {
  const team = await teamService.getTeam(req.project);
  res.status(200).json({
    status: "success",
    message: "Team retrieved successfully!",
    data: { team },
  });
});

// Update the team of the project (name and description)
exports.updateTeam = asyncHandler(async (req, res) => {
  const team = await teamService.updateTeam(req.project, req.body);
  res.status(200).json({
    status: "success",
    message: "Team updated successfully!",
    data: { team },
  });
});

// Delete the team of the project with its members
exports.deleteTeam = asyncHandler(async (req, res) => {
  await teamService.deleteTeam(req.project);
  res.status(200).json({
    status: "success",
    message: "Team deleted successfully!",
  });
});
