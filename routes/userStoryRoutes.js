const express = require("express");
const userStoryRouter = express.Router({ mergeParams: true });
const userStoryController = require("../controllers/userStoryController");
const projectMiddleware = require("../middlewares/projectMiddleware");
const Enums = require("../constants/enums");

// the Scrum team, the client and the admin can read the user stories, only the Product Owner manages them
const verifyProjectAccess = projectMiddleware.verifyProjectRole(...Enums.ROLE_ENUM, "Client", "Admin");
const verifyProductOwner = projectMiddleware.verifyProjectRole("ProductOwner");

userStoryRouter
  .route("/")
  .post(verifyProductOwner, userStoryController.createUserStory)
  .get(verifyProjectAccess, userStoryController.getAllUserStories);

userStoryRouter
  .route("/:id")
  .patch(verifyProductOwner, userStoryController.updateUserStory)
  .delete(verifyProductOwner, userStoryController.deleteUserStory)
  .get(verifyProjectAccess, userStoryController.getUserStoryById);

// the Product Owner accepts (Definition of Done met) or rejects a user story in review
userStoryRouter.route("/:id/accept").post(verifyProductOwner, userStoryController.acceptUserStory);

userStoryRouter.route("/:id/reject").post(verifyProductOwner, userStoryController.rejectUserStory);

module.exports = userStoryRouter;
