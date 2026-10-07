const notificationService = require("../services/notificationService");
const asyncHandler = require("../utils/asyncHandler");

// Create a notification and send it by email
exports.createNotification = asyncHandler(async (req, res) => {
  const notification = await notificationService.createNotification(req.project, req.body);
  res.status(201).json({
    status: "success",
    message: "Notification saved, the email is being sent (the sent field is updated once it is sent).",
    data: { notification },
  });
});

// Send a notification again (ex: after a failure), in background
exports.resendNotification = asyncHandler(async (req, res) => {
  const notification = await notificationService.resendNotification(req.project, req.params.id);
  res.status(202).json({
    status: "success",
    message: "The email is being sent again (the sent field is updated once it is sent).",
    data: { notification },
  });
});

// Get all the notifications of the project (ex: ?sprint=<id>)
exports.getAllNotifications = asyncHandler(async (req, res) => {
  const { docs: notifications, pagination } = await notificationService.getAllNotifications(req.project, req.query);
  res.status(200).json({
    status: "success",
    results: notifications.length,
    pagination,
    message: "Notifications retrieved successfully!",
    data: { notifications },
  });
});

// Get a notification by ID
exports.getNotificationById = asyncHandler(async (req, res) => {
  const notification = await notificationService.getNotificationById(req.project, req.params.id);
  res.status(200).json({
    status: "success",
    message: "Notification retrieved successfully!",
    data: { notification },
  });
});

// Delete a notification
exports.deleteNotification = asyncHandler(async (req, res) => {
  await notificationService.deleteNotification(req.project, req.params.id);
  res.status(200).json({
    status: "success",
    message: "Notification deleted successfully!",
  });
});
