const userService = require("../services/userService");
const asyncHandler = require("../utils/asyncHandler");

// The admin accepts or refuses a registration request, in case of refusal the account is deleted
exports.handleRegistrationRequest = asyncHandler(async (req, res) => {
  const result = await userService.handleRegistrationRequest(req.params.id, req.body);

  if (!result.accepted) {
    return res.status(200).json({
      status: "success",
      message: "The request has been refused and the user account has been deleted.",
    });
  }

  res.status(200).json({
    status: "success",
    message: "The user account has been activated, a confirmation email is sent to the user.",
    data: { user: result.user },
  });
});

// The admin gets the list of the registration requests
exports.getRegistrationRequests = asyncHandler(async (req, res) => {
  const { docs: requests, pagination } = await userService.getRegistrationRequests(req.query);
  res.status(200).json({
    status: "success",
    results: requests.length,
    pagination,
    message: "Registration requests retrieved successfully!",
    data: { requests },
  });
});

// The admin gets the list of the users (ex: to add them to a team)
exports.getAllUsers = asyncHandler(async (req, res) => {
  const { docs: users, pagination } = await userService.getAllUsers(req.query);
  res.status(200).json({
    status: "success",
    results: users.length,
    pagination,
    message: "Users retrieved successfully!",
    data: { users },
  });
});

// The logged-in user gets their profile and their Scrum roles in the projects
exports.getMyProfile = asyncHandler(async (req, res) => {
  const { user, memberships } = await userService.getMyProfile(req.user.id);
  res.status(200).json({
    status: "success",
    message: "Profile retrieved successfully!",
    data: { user, memberships },
  });
});

// The admin deactivates an account (the user is logged out at once)
exports.deactivateUser = asyncHandler(async (req, res) => {
  const user = await userService.deactivateUser(req.params.id);
  res.status(200).json({
    status: "success",
    message: "User deactivated successfully!",
    data: { user },
  });
});

// The admin activates again a deactivated account
exports.activateUser = asyncHandler(async (req, res) => {
  const user = await userService.activateUser(req.params.id);
  res.status(200).json({
    status: "success",
    message: "User activated successfully!",
    data: { user },
  });
});

// The admin deletes an account
exports.deleteUser = asyncHandler(async (req, res) => {
  await userService.deleteUser(req.params.id);
  res.status(200).json({
    status: "success",
    message: "User deleted successfully!",
  });
});
