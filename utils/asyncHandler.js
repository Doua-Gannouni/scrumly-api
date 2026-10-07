// Send the errors of an async route handler to the global error handler (Express 4 does not catch them)
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

module.exports = asyncHandler;
