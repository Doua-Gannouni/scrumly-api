const Notification = require("../models/notificationModel");
const Sprint = require("../models/sprintModel");
const Team = require("../models/teamModel");
const Member = require("../models/memberModel");
const User = require("../models/userModel");
const ApiFeatures = require("../utils/apiFeatures");
const pickFields = require("../utils/pickFields");
const { sendEmailInBackground } = require("../lib/email");
const normalizeEmail = require("../utils/normalizeEmail");
const { BadRequestError } = require("../utils/appError");
const { requireText } = require("../utils/validation");

// The notifications are only sent to the people of the project (members of the Scrum team and client) :
// the email account of the platform cannot be used to send emails to any address
// returns the saved email of the recipient
const checkRecipient = async (project, recipient) => {
  requireText(recipient, "Recipient");

  const team = await Team.findOne({ project: project._id });
  const members = team ? await Member.find({ team: team._id }) : [];
  const projectUsers = members.map((member) => member.user);
  if (project.client) {
    projectUsers.push(project.client);
  }

  const user = await User.findOne({ _id: { $in: projectUsers }, email: normalizeEmail(recipient) });
  if (!user) {
    throw new BadRequestError("The recipient must be a member of the Scrum team or the client of the project!");
  }
  return user.email;
};

// Send the notification by email in background : the request does not wait for the mail server
// (up to 10 s when it does not answer), the sent field is saved once the sending is over
const sendNotification = (notification) => {
  sendEmailInBackground(
    {
      toEmail: notification.recipient,
      subject: notification.subject,
      text: notification.message || notification.subject,
    },
    (sent) => Notification.updateOne({ _id: notification._id }, { sent }),
  );
};

// Create a notification and send it
exports.createNotification = async (project, body) => {
  const fields = pickFields(body, ["subject", "message", "recipient", "priority", "sprint"]);

  // the sprint must belong to the project
  if (fields.sprint) {
    await Sprint.findInProject(project._id, fields.sprint);
  }

  fields.recipient = await checkRecipient(project, fields.recipient);

  const notification = await Notification.create({ ...fields, project: project._id, sent: false });
  sendNotification(notification);
  return notification;
};

// Send a notification again (ex: after a failure), the recipient must still be in the project
exports.resendNotification = async (project, id) => {
  const notification = await Notification.findInProject(project._id, id);
  await checkRecipient(project, notification.recipient);

  notification.sent = false;
  await notification.save();
  sendNotification(notification);
  return notification;
};

// Get all the notifications of the project (ex: ?sprint=<id>)
exports.getAllNotifications = async (project, query) => {
  const features = new ApiFeatures(Notification.find({ project: project._id }), query).filter().pagination().sort();

  return await features.execute();
};

// Get a notification by ID
exports.getNotificationById = async (project, id) => {
  const notification = await Notification.findInProject(project._id, id);
  return await notification.populate("sprint", "name startDate endDate");
};

// Delete a notification
exports.deleteNotification = async (project, id) => {
  const notification = await Notification.findInProject(project._id, id);
  await notification.deleteOne();
};
