const mongoose = require("mongoose");
const { NotFoundError } = require("../utils/appError");
const Enum = require("../constants/enums");

const userStorySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "User story title is required"],
      maxlength: [200, "The title must not exceed 200 characters"],
      // format of a user story, in English or in French
      match: [
        /^(As an? .+ I (want|need) .+|En tant qu[e'] ?.+,? je (veux|souhaite|voudrais) .+)$/i,
        "User story must follow the format 'As a... I want...' (or 'En tant que... je veux...')",
      ],
    },
    description: {
      type: String,
    },
    // conditions the user story must satisfy to be accepted by the Product Owner
    acceptanceCriteria: [
      {
        type: String,
      },
    ],
    // order of the product backlog (1 = highest priority)
    priority: {
      type: Number,
      required: [true, "Priority is required"],
      min: [1, "Priority must be at least 1"],
    },
    storyPoints: {
      type: Number,
      required: [true, "Story points are required"],
      min: [0, "Story points cannot be negative"],
    },
    status: {
      type: String,
      enum: Enum.USER_STORY_STATUS_ENUM,
      default: "To do",
    },
    completedAt: {
      type: Date,
      default: null,
    },
    // Product Owner who accepted the user story (Definition of Done met)
    acceptedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    productBacklog: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductBacklog",
      required: true,
    },
    // sprint in which the user story is selected (null = still in the product backlog)
    sprint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sprint",
      default: null,
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

// save the completion date when the user story is done
userStorySchema.pre("save", function (next) {
  if (this.isModified("status")) {
    this.completedAt = this.status === "Done" ? this.completedAt || Date.now() : null;
  }
  next();
});

// tasks of the user story (virtual populate from the userStory field of the task)
userStorySchema.virtual("tasks", {
  ref: "Task",
  localField: "_id",
  foreignField: "userStory",
});

// product backlog in its order, user stories of a sprint
userStorySchema.index({ productBacklog: 1, priority: 1 });
userStorySchema.index({ sprint: 1 });

// Find a user story of a product backlog (the backlog of a project), or throw a "not found" error
userStorySchema.statics.findInBacklog = async function (productBacklogId, id, session = null) {
  const userStory = await this.findOne({ _id: id, productBacklog: productBacklogId }, null, { session });
  if (!userStory) {
    throw new NotFoundError("User story not found in this project!");
  }
  return userStory;
};

const UserStory = mongoose.model("UserStory", userStorySchema);
module.exports = UserStory;
