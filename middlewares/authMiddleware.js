const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const { UnauthorizedError, ForbiddenError } = require("../utils/appError");
const asyncHandler = require("../utils/asyncHandler");
const { config } = require("../config/config");

// Check the token and the user type (no allowed types = any logged-in user)
const verifyUserType = async (req, allowedTypes) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) {
    throw new UnauthorizedError("Access denied, you must be logged in");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, config.jwtSecret);
  } catch (err) {
    throw new UnauthorizedError("Invalid or expired token");
  }

  // Check that the user still exists
  const user = await User.findById(decoded.id);
  if (!user || !user.isActive) {
    throw new UnauthorizedError("User not found or account not activated");
  }

  // Check that the password was not changed after the creation of the token
  if (user.changedPasswordAfter(decoded.iat)) {
    throw new UnauthorizedError("Password changed, please log in again");
  }

  // Check the user type
  if (allowedTypes && !allowedTypes.includes(user.type)) {
    throw new ForbiddenError(`Access denied, you must be ${allowedTypes.join(" or ")}`);
  }

  req.user = { ...decoded, type: user.type };
};

// Check that the user is logged in (all types)
exports.verifyAuthentication = asyncHandler(async (req, res, next) => {
  await verifyUserType(req);
  next();
});

// Check admin
exports.verifyAdmin = asyncHandler(async (req, res, next) => {
  await verifyUserType(req, ["Admin"]);
  next();
});
