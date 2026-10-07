const express = require("express");
const notificationRouter = express.Router({ mergeParams: true });
const notificationController = require("../controllers/notificationController");
const projectMiddleware = require("../middlewares/projectMiddleware");

// Email notifications sent to the team (ex: sprint reminder)
const verifyNotificationManager = projectMiddleware.verifyProjectRole("ScrumMaster", "ProductOwner");

notificationRouter
  .route("/")
  .post(verifyNotificationManager, notificationController.createNotification)
  .get(verifyNotificationManager, notificationController.getAllNotifications);

notificationRouter
  .route("/:id")
  .delete(verifyNotificationManager, notificationController.deleteNotification)
  .get(verifyNotificationManager, notificationController.getNotificationById);

notificationRouter.route("/:id/resend").post(verifyNotificationManager, notificationController.resendNotification);

module.exports = notificationRouter;
