const mongoose = require("mongoose");
const Enums = require("../constants/enums");

const productBacklogSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product backlog name is required"],
    },
    description: {
      type: String,
    },
    // current Product Goal : long-term objective of the product (Scrum Guide)
    // one at a time : it must be fulfilled or abandoned before taking on the next one
    productGoal: {
      type: String,
      default: null,
    },
    // previous Product Goals (fulfilled or abandoned)
    productGoalHistory: [
      {
        _id: false,
        goal: { type: String },
        status: { type: String, enum: Enums.PRODUCT_GOAL_STATUS_ENUM },
        closedAt: { type: Date },
      },
    ],
  },
  {
    timestamps: true,
    // no "id" copy of "_id" in the responses (the virtuals are kept)
    id: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// user stories of the backlog ordered by priority (1 = highest priority)
productBacklogSchema.virtual("userStories", {
  ref: "UserStory",
  localField: "_id",
  foreignField: "productBacklog",
  options: { sort: { priority: 1 } },
});

const ProductBacklog = mongoose.model("ProductBacklog", productBacklogSchema);
module.exports = ProductBacklog;
