const { rateLimit } = require("express-rate-limit");

const MINUTE_IN_MS = 60 * 1000;

// Limit the number of requests of an IP address (protection against brute force attacks)
const createLimiter = ({ limit, minutes, message, onlyFailedRequests = false }) =>
  rateLimit({
    windowMs: minutes * MINUTE_IN_MS,
    limit,
    // the successful requests are not counted (ex: a user who logs in normally is never blocked)
    skipSuccessfulRequests: onlyFailedRequests,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { status: "fail", message },
  });

// 10 failed login attempts every 15 minutes
exports.loginLimiter = createLimiter({
  limit: 10,
  minutes: 15,
  onlyFailedRequests: true,
  message: "Too many failed login attempts, please try again in 15 minutes",
});

// 10 registrations every hour
exports.registerLimiter = createLimiter({
  limit: 10,
  minutes: 60,
  message: "Too many registrations, please try again in one hour",
});

// 5 password reset emails every hour
exports.forgotPasswordLimiter = createLimiter({
  limit: 5,
  minutes: 60,
  message: "Too many password reset requests, please try again in one hour",
});

// 10 password reset attempts every 15 minutes
exports.resetPasswordLimiter = createLimiter({
  limit: 10,
  minutes: 15,
  message: "Too many password reset attempts, please try again in 15 minutes",
});
