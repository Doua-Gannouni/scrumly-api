const mongoose = require("mongoose");
const { NotFoundError } = require("../utils/appError");
const Enums = require("../constants/enums");
const { SCRUM_EVENT_MAX_DURATION } = require("../constants/scrumRules");

// Scrum events : Sprint Planning, Daily Scrum, Sprint Review, Sprint Retrospective
const scrumEventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: Enums.SCRUM_EVENT_TYPE_ENUM,
      required: [true, "Event type is required"],
    },
    title: {
      type: String,
    },
    date: {
      type: Date,
      required: [true, "Event date is required"],
    },
    durationMinutes: {
      type: Number,
      required: [true, "Duration is required"],
      min: [1, "Duration must be at least 1 minute"],
      // every Scrum event has a maximum duration (timebox)
      validate: {
        validator: function (value) {
          const maxDuration = SCRUM_EVENT_MAX_DURATION[this.type];
          return !maxDuration || value <= maxDuration;
        },
        message:
          "The duration exceeds the timebox of this Scrum event (Sprint Planning 480 min, Daily Scrum 15 min, Sprint Review 240 min, Sprint Retrospective 180 min)",
      },
    },
    // outcome of the event
    notes: {
      type: String,
    },
    // improvements decided during the Sprint Retrospective (added to the Sprint Backlog of the next sprint)
    improvements: {
      type: [String],
      validate: {
        validator: function (value) {
          return !value.length || this.type === "SprintRetrospective";
        },
        message: "Only a Sprint Retrospective can have improvements",
      },
    },
    sprint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sprint",
      required: [true, "Sprint is required"],
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// events of a sprint and of a project, in their order
scrumEventSchema.index({ sprint: 1, date: 1 });
scrumEventSchema.index({ project: 1, date: 1 });

// Find an event of a project, or throw a "not found" error (the id alone is not enough : it must belong to the project)
scrumEventSchema.statics.findInProject = async function (projectId, id, session = null) {
  const event = await this.findOne({ _id: id, project: projectId }, null, { session });
  if (!event) {
    throw new NotFoundError("Event not found in this project!");
  }
  return event;
};

const ScrumEvent = mongoose.model("ScrumEvent", scrumEventSchema);
module.exports = ScrumEvent;
