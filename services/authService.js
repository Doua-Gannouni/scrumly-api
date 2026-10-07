const User = require("../models/userModel");
const SystemNotification = require("../models/systemNotificationModel");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { sendEmailInBackground } = require("../lib/email");
const { BadRequestError, UnauthorizedError, ForbiddenError } = require("../utils/appError");
const normalizeEmail = require("../utils/normalizeEmail");
const { runInTransaction } = require("../lib/database");
const { config } = require("../config/config");
const { requireText } = require("../utils/validation");

// Hash compared when the email is unknown : the login takes the same time whether the account exists or not
// (without it, an unknown email answers in a few ms and an existing one in ~250 ms because of bcrypt)
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString("hex"), 12);

// Generate a JWT token
const generateToken = (id, type) => {
  return jwt.sign(
    { id, type }, // data included in the token
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn },
  );
};

// Register a user (team member or client) waiting for the admin approval
// the Scrum role of a team member is given later, per project, when the admin adds them to a team
exports.register = async ({ name, email, password, type }) => {
  // An admin account cannot be created by registration
  if (type === "Admin") {
    throw new ForbiddenError("An admin account cannot be created by registration");
  }

  // the user and the notification for the admin are saved together
  return await runInTransaction(async (session) => {
    const user = new User({ name, email, password, type, isActive: false });
    await user.save({ session });

    await SystemNotification.create(
      [
        {
          user: user._id,
          message: `New registration request from ${user.name}. Accept or refuse the request.`,
          type: "registration_request",
        },
      ],
      { session },
    );

    return user;
  });
};

// Login : returns the JWT token and the user
exports.login = async ({ email, password }) => {
  requireText(email, "Email");
  requireText(password, "Password");

  const user = await User.findOne({ email: normalizeEmail(email) }).select("+password");

  // Same message and same time if the email or the password is wrong (do not reveal if the account exists)
  const passwordIsCorrect = user
    ? await user.correctPassword(password)
    : (await bcrypt.compare(password, DUMMY_PASSWORD_HASH)) && false;
  if (!passwordIsCorrect) {
    throw new UnauthorizedError("Incorrect email or password");
  }

  if (!user.isActive) {
    throw new ForbiddenError(
      "Your account is not active (waiting for the admin approval or deactivated by the admin).",
    );
  }

  return {
    token: generateToken(user._id, user.type),
    user: { _id: user._id, name: user.name, email: user.email, type: user.type },
  };
};

// Send a password reset code by email
// the answer is the same whether the account exists or not (no account enumeration) :
// no error when the email cannot be sent, and the email is sent in background (same response time)
exports.forgotPassword = async ({ email }) => {
  requireText(email, "Email");

  // an account waiting for the admin approval cannot reset its password
  const user = await User.findOne({ email: normalizeEmail(email), isActive: true });
  if (!user) return;

  const resetToken = user.createPasswordResetToken();
  await user.save();

  sendEmailInBackground(
    {
      toEmail: user.email,
      subject: "Reset your password",
      text: `Your reset code : ${resetToken}`,
    },
    async (sent) => {
      // Cancel the code if the email could not be sent (unless a new code was asked in the meantime)
      if (!sent) {
        await User.updateOne(
          { _id: user._id, resetPasswordToken: user.resetPasswordToken },
          { resetPasswordToken: null, resetPasswordTokenExpiresAt: null },
        );
      }
    },
  );
};

// The logged-in user changes their password : the tokens created before are no longer valid
// (other devices are logged out), a new token is returned for the current session
exports.changePassword = async (userId, { currentPassword, newPassword }) => {
  requireText(currentPassword, "currentPassword");
  requireText(newPassword, "newPassword");

  const user = await User.findById(userId).select("+password");
  if (!user || !(await user.correctPassword(currentPassword))) {
    throw new UnauthorizedError("The current password is incorrect.");
  }

  user.password = newPassword;
  await user.save();
  return { token: generateToken(user._id, user.type) };
};

// Reset the password with the code received by email
exports.resetPassword = async (token, { password }) => {
  requireText(password, "The new password");

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordTokenExpiresAt: { $gt: Date.now() }, // the token is not expired
  });

  if (!user) {
    throw new BadRequestError("Invalid or expired token.");
  }

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordTokenExpiresAt = undefined;
  await user.save();
};
