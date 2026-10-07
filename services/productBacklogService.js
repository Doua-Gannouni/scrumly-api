const ProductBacklog = require("../models/productBacklogModel");
const UserStory = require("../models/userStoryModel");
const pickFields = require("../utils/pickFields");
const { NotFoundError, ConflictError } = require("../utils/appError");

// Find the product backlog of the project
const findProductBacklog = async (project) => {
  const productBacklog = await ProductBacklog.findById(project.productBacklog);
  if (!productBacklog) {
    throw new NotFoundError("Product backlog not found!");
  }
  return productBacklog;
};

// Get the product backlog : user stories not done and not selected in a sprint, ordered by priority
exports.getProductBacklog = async (project) => {
  const productBacklog = await findProductBacklog(project);

  const userStories = await UserStory.find({
    productBacklog: productBacklog._id,
    sprint: null,
    status: { $ne: "Done" },
  }).sort("priority createdAt");

  return { productBacklog, definitionOfDone: project.definitionOfDone, userStories };
};

// The Product Owner updates the product backlog (name, description, Product Goal)
exports.updateProductBacklog = async (project, body) => {
  const productBacklog = await findProductBacklog(project);
  const fields = pickFields(body, ["name", "description", "productGoal"]);

  // one Product Goal at a time : fulfill or abandon it before taking on the next one (Scrum Guide)
  if (
    fields.productGoal !== undefined &&
    productBacklog.productGoal &&
    fields.productGoal !== productBacklog.productGoal
  ) {
    throw new ConflictError("The current Product Goal must be fulfilled or abandoned before taking on the next one!");
  }

  productBacklog.set(fields);
  return await productBacklog.save();
};

// Close the current Product Goal (Fulfilled or Abandoned) and keep it in the history
exports.closeProductGoal = async (project, status) => {
  const productBacklog = await findProductBacklog(project);

  if (!productBacklog.productGoal) {
    throw new ConflictError("There is no current Product Goal!");
  }

  productBacklog.productGoalHistory.push({
    goal: productBacklog.productGoal,
    status,
    closedAt: Date.now(),
  });
  productBacklog.productGoal = null;
  return await productBacklog.save();
};

// Get the product backlog and all its user stories ordered by priority (for the exports)
exports.getBacklogReport = async (project) => {
  const productBacklog = await findProductBacklog(project);
  const userStories = await UserStory.find({ productBacklog: productBacklog._id })
    .populate("sprint", "name")
    .sort("priority createdAt");
  return { productBacklog, userStories };
};
