const mongoose = require("mongoose");
const Enums = require("../constants/enums");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { config } = require("../config/config");

const userSchema = new mongoose.Schema(
  {
    // two people can have the same name, the email identifies the user
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    // saved in lowercase : Ali@x.com and ali@x.com are the same account
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Enter a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must contain at least 8 characters"],
      select: false, // the (hashed) password is never returned in the responses
    },
    passwordUpdatedAt: {
      type: Date,
      default: Date.now,
    },
    // account type chosen at registration (the Scrum role of a user is defined per project in the team)
    type: {
      type: String,
      enum: Enums.USER_TYPE_ENUM,
      required: [true, "Type is required"],
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    resetPasswordToken: {
      type: String,
      default: null,
      select: false,
    },
    resetPasswordTokenExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
  },
  { timestamps: true },
);

// Generate a password reset token
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");

  // Hash the token before saving it
  this.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
  this.resetPasswordTokenExpiresAt = Date.now() + 10 * 60 * 1000; // token expires in 10 minutes

  return resetToken; // Return the plain token to send it by email
};

// hash the password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);

  this.passwordUpdatedAt = Date.now();
  next();
});

userSchema.methods.correctPassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// returns true if the password was changed after the creation of the JWT token
userSchema.methods.changedPasswordAfter = function (JWTTime) {
  if (!this.passwordUpdatedAt) return false;
  const passwordUpdateTime = parseInt(this.passwordUpdatedAt.getTime() / 1000);
  return JWTTime < passwordUpdateTime;
};

// Create the default admin if there is no admin yet
userSchema.statics.createDefaultAdmin = async function () {
  const adminExist = await this.findOne({ type: "Admin" });

  if (!adminExist) {
    // the credentials of the default admin are in the .env file
    if (!config.admin.email || !config.admin.password) {
      console.log("ADMIN_EMAIL and ADMIN_PASSWORD must be defined in .env to create the default admin");
      return;
    }

    const admin = new this({
      name: "Admin",
      email: config.admin.email,
      password: config.admin.password,
      type: "Admin",
      isActive: true,
    });

    await admin.save();
    console.log("Default admin created");
  }
};

const User = mongoose.model("User", userSchema);
module.exports = User;
