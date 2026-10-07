const mongoose = require("mongoose");
const Enum = require("../constants/enums");

// notifications for the admin (ex: registration requests)
const systemNotificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    seen: {
      type: Boolean,
      default: false,
    },
    type: {
      type: String,
      enum: Enum.SYSTEM_NOTIFICATION_TYPE_ENUM,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// registration requests of a user
systemNotificationSchema.index({ user: 1, type: 1 });

const SystemNotification = mongoose.model("SystemNotification", systemNotificationSchema);
module.exports = SystemNotification;
