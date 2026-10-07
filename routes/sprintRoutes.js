const express = require("express");
const sprintRouter = express.Router({ mergeParams: true });
const sprintController = require("../controllers/sprintController");
const projectMiddleware = require("../middlewares/projectMiddleware");
const Enums = require("../constants/enums");

// the Scrum Master manages the sprints, only the Product Owner can cancel a sprint (Scrum Guide)
// the Developers select the user stories with the Product Owner (Sprint Planning)
// the Sprint Backlog is a plan by and for the Developers (improvements)
const verifyProjectAccess = projectMiddleware.verifyProjectRole(...Enums.ROLE_ENUM, "Client", "Admin");
const verifyScrumMaster = projectMiddleware.verifyProjectRole("ScrumMaster");
const verifyProductOwner = projectMiddleware.verifyProjectRole("ProductOwner");
const verifySprintPlanning = projectMiddleware.verifyProjectRole("Developer", "ProductOwner");
const verifyDeveloper = projectMiddleware.verifyProjectRole("Developer");

sprintRouter
  .route("/")
  .post(verifyScrumMaster, sprintController.createSprint)
  .get(verifyProjectAccess, sprintController.getAllSprints);

sprintRouter
  .route("/:id")
  .patch(verifyScrumMaster, sprintController.updateSprint)
  .delete(verifyScrumMaster, sprintController.deleteSprint)
  .get(verifyProjectAccess, sprintController.getSprintById);

sprintRouter.route("/:id/start").post(verifyScrumMaster, sprintController.startSprint);

sprintRouter.route("/:id/complete").post(verifyScrumMaster, sprintController.completeSprint);

sprintRouter.route("/:id/cancel").post(verifyProductOwner, sprintController.cancelSprint);

sprintRouter.route("/:id/user-stories").post(verifySprintPlanning, sprintController.addUserStories);

sprintRouter.route("/:id/user-stories/:userStoryId").delete(verifySprintPlanning, sprintController.removeUserStory);

sprintRouter.route("/:id/improvements").post(verifyDeveloper, sprintController.addImprovement);

sprintRouter.route("/:id/improvements/:improvementId").patch(verifyDeveloper, sprintController.updateImprovement);

sprintRouter.route("/:id/burndown").get(verifyProjectAccess, sprintController.getBurndown);

module.exports = sprintRouter;
