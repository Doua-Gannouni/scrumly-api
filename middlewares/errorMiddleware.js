const multer = require("multer");
const { NotFoundError } = require("../utils/appError");

// Name of a field for the messages ("_id" is the id of the resource)
const fieldName = (path) => (path === "_id" ? "id" : path);

// Message of a validation error of mongoose, without the internal names (model, cast details) :
// "Project validation failed: endDate: End date must be ..." -> "End date must be ..."
const getValidationMessage = (err) =>
  Object.values(err.errors)
    .map((error) => (error.name === "CastError" ? `Invalid ${fieldName(error.path)}` : error.message))
    .join(". ");

// Status code and message of an error :
// the status of an AppError, 400 for the invalid data (validation, cast, upload), 409 for a duplicate value, 500 otherwise
const getErrorResponse = (err) => {
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    return { statusCode: 409, message: field ? `This ${fieldName(field)} is already used!` : "Duplicate value!" };
  }
  if (err.name === "ValidationError") {
    return { statusCode: 400, message: getValidationMessage(err) };
  }
  // ex: "Cast to ObjectId failed for value "abc" (type string) at path "_id" for model "Project"" -> "Invalid id"
  if (err.name === "CastError") {
    return { statusCode: 400, message: `Invalid ${fieldName(err.path)}` };
  }
  if (err instanceof multer.MulterError) {
    return { statusCode: 400, message: err.message };
  }

  // AppError, invalid JSON body (status set by Express) ...
  const statusCode = err.statusCode || err.status || 500;
  return { statusCode, message: statusCode >= 500 ? "Internal server error" : err.message };
};

// Route not found
exports.handleNotFound = (req, res, next) => {
  next(new NotFoundError(`Route ${req.originalUrl} not found`));
};

// Global error handler : every error of the routes and middlewares ends here
exports.handleErrors = (err, req, res, next) => {
  // the response has already started (ex: PDF export) : Express closes the connection
  if (res.headersSent) {
    return next(err);
  }

  const { statusCode, message } = getErrorResponse(err);
  if (statusCode >= 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    status: statusCode >= 500 ? "error" : "fail",
    message,
  });
};
