const mongoose = require("mongoose");
const { NotFoundError } = require("../utils/appError");
const Enums = require("../constants/enums");

// a member is a user in a Scrum team with a role (the role is defined per project)
const memberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: [true, "Team is required"],
    },
    role: {
      type: String,
      enum: Enums.ROLE_ENUM,
      required: [true, "Role is required"],
    },
    description: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

// a user is only once in a team
memberSchema.index({ user: 1, team: 1 }, { unique: true });

// members of a team (the index above starts with the user)
memberSchema.index({ team: 1 });

// Find a member of a team, or throw a "not found" error
memberSchema.statics.findInTeam = async function (teamId, id, session = null) {
  const member = await this.findOne({ _id: id, team: teamId }, null, { session });
  if (!member) {
    throw new NotFoundError("Member not found in this team!");
  }
  return member;
};

const Member = mongoose.model("Member", memberSchema);
module.exports = Member;
