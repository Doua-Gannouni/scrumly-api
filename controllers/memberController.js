const memberService = require("../services/memberService");
const asyncHandler = require("../utils/asyncHandler");

// Get the members of the team of the project
exports.getMembers = asyncHandler(async (req, res) => {
  const members = await memberService.getMembers(req.project);
  res.status(200).json({
    status: "success",
    results: members.length,
    message: "Members retrieved successfully!",
    data: { members },
  });
});

// Add a user to the team of the project with a Scrum role
exports.addMember = asyncHandler(async (req, res) => {
  const member = await memberService.addMember(req.project, req.body);
  res.status(201).json({
    status: "success",
    message: "Member added successfully!",
    data: { member },
  });
});

// Update the role or the description of a member
exports.updateMember = asyncHandler(async (req, res) => {
  const member = await memberService.updateMember(req.project, req.params.id, req.body);
  res.status(200).json({
    status: "success",
    message: "Member updated successfully!",
    data: { member },
  });
});

// Remove a member from the team
exports.deleteMember = asyncHandler(async (req, res) => {
  await memberService.deleteMember(req.project, req.params.id);
  res.status(200).json({
    status: "success",
    message: "Member deleted successfully!",
  });
});
