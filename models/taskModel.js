const mongoose = require("mongoose");
const { NotFoundError } = require("../utils/appError");
const Enums = require("../constants/enums");

const taskSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Task name is required"],
    },
    description: {
      type: String,
    },
    estimatedHours: {
      type: Number,
      min: [0, "Estimated hours cannot be negative"],
    },
    status: {
      type: String,
      enum: Enums.TASK_STATUS_ENUM,
      default: "To do",
    },
    userStory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserStory",
      required: [true, "User story is required"],
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    // developer of the team responsible for the task
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

// tasks of a project (and of a developer), tasks of a user story
taskSchema.index({ project: 1, assignedTo: 1 });
taskSchema.index({ userStory: 1 });

// Find a task of a project, or throw a "not found" error (the id alone is not enough : it must belong to the project)
taskSchema.statics.findInProject = async function (projectId, id, session = null) {
  const task = await this.findOne({ _id: id, project: projectId }, null, { session });
  if (!task) {
    throw new NotFoundError("Task not found in this project!");
  }
  return task;
};

const Task = mongoose.model("Task", taskSchema);
module.exports = Task;
