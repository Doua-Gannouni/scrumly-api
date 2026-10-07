const mongoose = require("mongoose");
const { NotFoundError } = require("../utils/appError");

// Email notifications sent to the team (ex: sprint reminder)
const notificationSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      required: [true, "Notification subject is required"],
    },
    message: {
      type: String,
    },
    // email address of the recipient
    recipient: {
      type: String,
      required: [true, "Recipient is required"],
      match: [/^\S+@\S+\.\S+$/, "Enter a valid email"],
    },
    priority: {
      type: Number,
    },
    sprint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sprint",
      default: null,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    // true if the email was sent to the recipient
    sent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// notifications of a project
notificationSchema.index({ project: 1 });

// Find a notification of a project, or throw a "not found" error (the id alone is not enough : it must belong to the project)
notificationSchema.statics.findInProject = async function (projectId, id, session = null) {
  const notification = await this.findOne({ _id: id, project: projectId }, null, { session });
  if (!notification) {
    throw new NotFoundError("Notification not found in this project!");
  }
  return notification;
};

const Notification = mongoose.model("Notification", notificationSchema);
module.exports = Notification;
