const authService = require("../services/authService");
const asyncHandler = require("../utils/asyncHandler");

// Register a user (waiting for the admin approval)
exports.register = asyncHandler(async (req, res) => {
  await authService.register(req.body);
  res.status(201).json({
    status: "success",
    message: "User created, waiting for the admin approval",
  });
});

// Login
exports.login = asyncHandler(async (req, res) => {
  const { token, user } = await authService.login(req.body);
  res.status(200).json({
    status: "success",
    message: "Logged in successfully",
    data: { token, user },
  });
});

// Send a password reset code by email
exports.forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.body);
  res.status(200).json({
    status: "success",
    message: "If this email exists, a reset code has been sent.",
  });
});

// Reset the password with the code received by email
exports.resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.params.token, req.body);
  res.status(200).json({
    status: "success",
    message: "Password reset successfully.",
  });
});

// The logged-in user changes their password (a new token is returned, the other sessions are logged out)
exports.changePassword = asyncHandler(async (req, res) => {
  const { token } = await authService.changePassword(req.user.id, req.body);
  res.status(200).json({
    status: "success",
    message: "Password changed successfully.",
    data: { token },
  });
});
