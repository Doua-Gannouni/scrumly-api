const mongoose = require("mongoose");
const Enums = require("../constants/enums");

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Project name is required"],
      unique: true,
    },
    description: {
      type: String,
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
      validate: {
        validator: function (value) {
          return !this.startDate || !value || value >= this.startDate;
        },
        message: "End date must be after the start date",
      },
    },
    budget: {
      type: Number,
      min: [0, "Budget cannot be negative"],
    },
    priority: {
      type: Number,
    },
    status: {
      type: String,
      enum: Enums.PROJECT_STATUS_ENUM,
      default: "In progress",
    },
    // Definition of Done : quality criteria that every increment must meet (Scrum Guide)
    definitionOfDone: [
      {
        type: String,
      },
    ],
    // client (stakeholder) of the project, read-only access
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    productBacklog: { type: mongoose.Schema.Types.ObjectId, ref: "ProductBacklog", required: true },
    images: [
      {
        type: String,
      },
    ],
    files: [
      {
        type: String,
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

// Scrum team of the project (one team per project)
projectSchema.virtual("team", {
  ref: "Team",
  localField: "_id",
  foreignField: "project",
  justOne: true,
});

// sprints of the project
projectSchema.virtual("sprints", {
  ref: "Sprint",
  localField: "_id",
  foreignField: "project",
  options: { sort: { startDate: 1 } },
});

// increments delivered by the sprints of the project
projectSchema.virtual("increments", {
  ref: "Increment",
  localField: "_id",
  foreignField: "project",
});

// projects of a client
projectSchema.index({ client: 1 });

const Project = mongoose.model("Project", projectSchema);
module.exports = Project;
