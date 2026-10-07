const mongoose = require("mongoose");
const { NotFoundError } = require("../utils/appError");

// Increment : user stories that meet the Definition of Done (Scrum Guide)
// several increments may be created within a sprint
const incrementSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Increment name is required"],
    },
    description: {
      type: String,
    },
    userStories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "UserStory",
      },
    ],
    storyPoints: {
      type: Number,
      default: 0,
    },
    // Definition of Done met by the increment
    definitionOfDone: [
      {
        type: String,
      },
    ],
    // true when the increment is delivered to the stakeholders
    delivered: {
      type: Boolean,
      default: false,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    sprint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sprint",
      required: [true, "Sprint is required"],
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: [true, "Project is required"],
    },
  },
  {
    timestamps: true,
  },
);

// increments of a sprint and of a project
incrementSchema.index({ sprint: 1 });
incrementSchema.index({ project: 1 });

// Find an increment of a project, or throw a "not found" error (the id alone is not enough : it must belong to the project)
incrementSchema.statics.findInProject = async function (projectId, id, session = null) {
  const increment = await this.findOne({ _id: id, project: projectId }, null, { session });
  if (!increment) {
    throw new NotFoundError("Increment not found in this project!");
  }
  return increment;
};

const Increment = mongoose.model("Increment", incrementSchema);
module.exports = Increment;
