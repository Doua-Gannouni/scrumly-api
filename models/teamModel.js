const mongoose = require("mongoose");
const { NotFoundError } = require("../utils/appError");

const teamSchema = new mongoose.Schema(
  {
    // two projects can have teams with the same name (a project has one team)
    name: {
      type: String,
      required: [true, "Team name is required"],
    },
    description: {
      type: String,
    },
    // one Scrum team per project
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: [true, "Project is required"],
      unique: true,
    },
  },
  {
    timestamps: true,
    // no "id" copy of "_id" in the responses (the virtuals are kept)
    id: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// members of the team with their Scrum role
teamSchema.virtual("members", {
  ref: "Member",
  localField: "_id",
  foreignField: "team",
});

// Find the Scrum team of a project, or throw a "not found" error
teamSchema.statics.findOfProject = async function (projectId, session = null) {
  const team = await this.findOne({ project: projectId }, null, { session });
  if (!team) {
    throw new NotFoundError("This project has no team yet!");
  }
  return team;
};

const Team = mongoose.model("Team", teamSchema);
module.exports = Team;
