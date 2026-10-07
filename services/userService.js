const User = require("../models/userModel");
const Member = require("../models/memberModel");
const Task = require("../models/taskModel");
const Project = require("../models/projectModel");
const SystemNotification = require("../models/systemNotificationModel");
const ApiFeatures = require("../utils/apiFeatures");
const { sendEmailInBackground } = require("../lib/email");
const { ForbiddenError, NotFoundError, ConflictError } = require("../utils/appError");
const { runInTransaction } = require("../lib/database");
const { requireBoolean } = require("../utils/validation");

// The admin accepts (accepted: true) or refuses (accepted: false) the registration request of a user
// in case of refusal the account is deleted : only a real boolean is accepted (a typo must not delete an account)
// and only a pending request can be handled (an account deactivated later is not a registration request)
exports.handleRegistrationRequest = async (userId, { accepted }) => {
  requireBoolean(accepted, "accepted (true accepts, false refuses)");

  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError("User not found.");
  }
  const request = await SystemNotification.findOne({ user: user._id, type: "registration_request", seen: false });
  if (!request) {
    throw new ConflictError("This user has no pending registration request.");
  }

  // Accept the request : the account is activated and the request is marked as seen
  if (accepted) {
    await runInTransaction(async (session) => {
      await User.updateOne({ _id: user._id }, { isActive: true }, { session });
      await SystemNotification.updateMany(
        { user: user._id, type: "registration_request" },
        { seen: true },
        { session },
      );
    });

    sendEmailInBackground({
      toEmail: user.email,
      subject: "Your account has been activated",
      text: `Hello ${user.name}, your account has been activated successfully. You can now log in.`,
    });

    return { accepted: true, user: await User.findById(user._id) };
  }

  // Refuse the request : the account and its notifications are deleted together
  await runInTransaction(async (session) => {
    await SystemNotification.deleteMany({ user: user._id }, { session });
    await User.deleteOne({ _id: user._id }, { session });
  });

  sendEmailInBackground({
    toEmail: user.email,
    subject: "Your registration request has been refused",
    text: `Hello ${user.name}, your registration request has been refused. Please contact the admin.`,
  });

  return { accepted: false };
};

// Find a user that the admin can manage (not an admin account)
const findManagedUser = async (id, session) => {
  const user = await User.findById(id, null, { session });
  if (!user) {
    throw new NotFoundError("User not found.");
  }
  if (user.type === "Admin") {
    throw new ForbiddenError("An admin account cannot be modified.");
  }
  return user;
};

// The admin deactivates an account : the user is logged out at once (the token is checked against isActive)
exports.deactivateUser = async (id) => {
  const user = await findManagedUser(id);
  if (!user.isActive) {
    throw new ConflictError("This account is already deactivated.");
  }
  user.isActive = false;
  return await user.save();
};

// The admin activates again a deactivated account (a registration request is handled with PATCH /users/:id/registration)
exports.activateUser = async (id) => {
  const user = await findManagedUser(id);
  if (user.isActive) {
    throw new ConflictError("This account is already active.");
  }
  if (await SystemNotification.exists({ user: user._id, type: "registration_request", seen: false })) {
    throw new ConflictError(
      "This account is waiting for the approval of its registration request (PATCH /users/:id/registration).",
    );
  }
  user.isActive = true;
  return await user.save();
};

// The admin deletes an account : it leaves the Scrum teams, its tasks are no longer assigned
// and it is no longer the client of its projects (the history, ex: accepted user stories, keeps its id)
exports.deleteUser = async (id) => {
  await runInTransaction(async (session) => {
    const user = await findManagedUser(id, session);

    await Member.deleteMany({ user: user._id }, { session });
    await Task.updateMany({ assignedTo: user._id }, { assignedTo: null }, { session });
    await Project.updateMany({ client: user._id }, { client: null }, { session });
    await SystemNotification.deleteMany({ user: user._id }, { session });
    await User.deleteOne({ _id: user._id }, { session });
  });
};

// The admin gets the list of the registration requests
exports.getRegistrationRequests = async (query) => {
  const features = new ApiFeatures(
    SystemNotification.find({ type: "registration_request" }).populate("user", "name email type isActive"),
    query,
  )
    .filter()
    .sort()
    .pagination();

  return await features.execute();
};

// fields of the users that cannot be used to filter the list
const SENSITIVE_FIELDS = ["password", "resetPasswordToken", "resetPasswordTokenExpiresAt"];

// The admin gets the list of the users (filtering on the sensitive fields is not allowed)
exports.getAllUsers = async (query) => {
  const safeQuery = { ...query };
  SENSITIVE_FIELDS.forEach((field) => delete safeQuery[field]);

  const features = new ApiFeatures(User.find(), safeQuery).filter().sort().pagination();

  return await features.execute();
};

// The logged-in user gets their profile and their Scrum roles in the projects
exports.getMyProfile = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError("User not found.");
  }

  const members = await Member.find({ user: user._id }).populate({
    path: "team",
    select: "name project",
    populate: { path: "project", select: "name status" },
  });

  const memberships = members.map((member) => ({
    role: member.role,
    team: member.team,
  }));

  return { user, memberships };
};
