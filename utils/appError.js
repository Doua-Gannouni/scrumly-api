// Errors of the application : each kind of error has its HTTP status, sent by the global error handler.
// The services only choose the kind of error, they never write a status code.
class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

// the request is invalid (missing field, wrong value)
class BadRequestError extends AppError {
  constructor(message) {
    super(message, 400);
  }
}

// not logged in, invalid token or wrong credentials
class UnauthorizedError extends AppError {
  constructor(message) {
    super(message, 401);
  }
}

// the role of the user does not allow the action
class ForbiddenError extends AppError {
  constructor(message) {
    super(message, 403);
  }
}

// a resource (of the URL or of the body) does not exist
class NotFoundError extends AppError {
  constructor(message) {
    super(message, 404);
  }
}

// the request is valid but the current state of the data prevents it (ex: sprint already in progress)
class ConflictError extends AppError {
  constructor(message) {
    super(message, 409);
  }
}

module.exports = { BadRequestError, UnauthorizedError, ForbiddenError, NotFoundError, ConflictError };
