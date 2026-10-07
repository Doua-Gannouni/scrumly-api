const Increment = require("../models/incrementModel");
const ApiFeatures = require("../utils/apiFeatures");
const pickFields = require("../utils/pickFields");
const { ConflictError } = require("../utils/appError");

// Get all the increments of the project (an increment is born when a user story meets the Definition of Done)
exports.getAllIncrements = async (project, query) => {
  const features = new ApiFeatures(Increment.find({ project: project._id }).populate("sprint", "name goal"), query)
    .filter()
    .pagination()
    .sort();

  return await features.execute();
};

// Get an increment with its user stories
exports.getIncrementById = async (project, id) => {
  const increment = await Increment.findInProject(project._id, id);
  return await increment.populate([
    { path: "sprint", select: "name goal startDate endDate" },
    { path: "userStories", select: "title storyPoints acceptanceCriteria completedAt" },
  ]);
};

// Update the name or the description of an increment
exports.updateIncrement = async (project, id, body) => {
  const increment = await Increment.findInProject(project._id, id);
  increment.set(pickFields(body, ["name", "description"]));
  return await increment.save();
};

// The Product Owner delivers the increment to the stakeholders (possible before the end of the sprint)
// the next accepted user stories of the sprint form a new increment
exports.deliverIncrement = async (project, id) => {
  const increment = await Increment.findInProject(project._id, id);
  if (increment.delivered) {
    throw new ConflictError("This increment is already delivered!");
  }

  increment.delivered = true;
  increment.deliveredAt = Date.now();
  return await increment.save();
};
