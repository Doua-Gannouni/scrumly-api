const express = require("express");
const authRouter = express.Router();
const authController = require("../controllers/authController");
const rateLimitMiddleware = require("../middlewares/rateLimitMiddleware");

// route to register a user (waiting for the admin approval)
authRouter.route("/register").post(rateLimitMiddleware.registerLimiter, authController.register);

authRouter.route("/login").post(rateLimitMiddleware.loginLimiter, authController.login);

authRouter.route("/forgot-password").post(rateLimitMiddleware.forgotPasswordLimiter, authController.forgotPassword);

authRouter.route("/reset-password/:token").post(rateLimitMiddleware.resetPasswordLimiter, authController.resetPassword);

module.exports = authRouter;
