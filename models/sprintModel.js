const mongoose = require("mongoose");
const { NotFoundError } = require("../utils/appError");
const Enums = require("../constants/enums");
const { startOfDay, addMonths } = require("../utils/dateUtils");

const sprintSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Sprint name is required"],
    },
    description: {
      type: String,
    },
    // Sprint Goal : single objective of the sprint (Scrum Guide)
    goal: {
      type: String,
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
      validate: [
        {
          validator: function (value) {
            return !this.startDate || !value || value >= this.startDate;
          },
          message: "End date must be after the start date",
        },
        {
          // a sprint lasts one month or less (Scrum Guide) : the end date is the last day of the sprint,
          // so it is before the same day of the next month (Mar 1 -> Mar 31, Jan 31 -> Feb 27)
          // only checked when the dates change (the sprints saved before keep working)
          validator: function (value) {
            if (!this.startDate || !value) return true;
            if (!this.isNew && !this.isModified("startDate") && !this.isModified("endDate")) return true;
            return startOfDay(value) < addMonths(this.startDate, 1);
          },
          message: "A sprint must last one month or less (the end date is the last day of the sprint)",
        },
      ],
    },
    status: {
      type: String,
      enum: Enums.SPRINT_STATUS_ENUM,
      default: "Planned",
    },
    // story points of the selected user stories when the sprint starts (used by the burndown chart)
    committedStoryPoints: {
      type: Number,
      default: 0,
    },
    // improvements of the Sprint Backlog (ex: decided during the previous Sprint Retrospective)
    improvements: [
      new mongoose.Schema(
        {
          description: {
            type: String,
            required: [true, "Improvement description is required"],
          },
          done: {
            type: Boolean,
            default: false,
          },
          fromRetrospective: {
            type: Boolean,
            default: false,
          },
        },
        { id: false },
      ),
    ],
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: [true, "Project is required"],
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

// the name of a sprint is unique in a project
sprintSchema.index({ name: 1, project: 1 }, { unique: true });

// only one sprint in progress at a time in a project (checked by the database : two simultaneous starts cannot both succeed)
sprintSchema.index({ project: 1 }, { unique: true, partialFilterExpression: { status: "In progress" } });

// Sprint Backlog : user stories selected for the sprint
sprintSchema.virtual("userStories", {
  ref: "UserStory",
  localField: "_id",
  foreignField: "sprint",
  options: { sort: { priority: 1 } },
});

// Scrum events of the sprint
sprintSchema.virtual("events", {
  ref: "ScrumEvent",
  localField: "_id",
  foreignField: "sprint",
  options: { sort: { date: 1 } },
});

// increments created during the sprint (several increments are possible)
sprintSchema.virtual("increments", {
  ref: "Increment",
  localField: "_id",
  foreignField: "sprint",
});

// sprints of a project in their order
sprintSchema.index({ project: 1, startDate: 1 });

// Find a sprint of a project, or throw a "not found" error (the id alone is not enough : it must belong to the project)
sprintSchema.statics.findInProject = async function (projectId, id, session = null) {
  const sprint = await this.findOne({ _id: id, project: projectId }, null, { session });
  if (!sprint) {
    throw new NotFoundError("Sprint not found in this project!");
  }
  return sprint;
};

const Sprint = mongoose.model("Sprint", sprintSchema);
module.exports = Sprint;
