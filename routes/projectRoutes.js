const express = require("express");
const projectRouter = express.Router();
const projectController = require("../controllers/projectController");
const sprintController = require("../controllers/sprintController");
const authMiddleware = require("../middlewares/authMiddleware");
const projectMiddleware = require("../middlewares/projectMiddleware");
const upload = require("../middlewares/uploadMiddleware");
const Enums = require("../constants/enums");
const productBacklogRouter = require("./productBacklogRoutes");
const userStoryRouter = require("./userStoryRoutes");
const sprintRouter = require("./sprintRoutes");
const taskRouter = require("./taskRoutes");
const scrumEventRouter = require("./scrumEventRoutes");
const incrementRouter = require("./incrementRoutes");
const notificationRouter = require("./notificationRoutes");
const teamRouter = require("./teamRoutes");
const memberRouter = require("./memberRoutes");

// the Scrum team, the client and the admin can read the project, the admin manages the projects
const verifyProjectAccess = projectMiddleware.verifyProjectRole(...Enums.ROLE_ENUM, "Client", "Admin");
const uploadFiles = upload.fields([
  { name: "images", maxCount: 5 },
  { name: "files", maxCount: 5 },
]);

// every project route needs a logged-in user
projectRouter.use(authMiddleware.verifyAuthentication);

// routes of the project content
projectRouter.use("/:projectId/team/members", memberRouter);
projectRouter.use("/:projectId/team", teamRouter);
projectRouter.use("/:projectId/backlog", productBacklogRouter);
projectRouter.use("/:projectId/user-stories", userStoryRouter);
projectRouter.use("/:projectId/sprints", sprintRouter);
projectRouter.use("/:projectId/tasks", taskRouter);
projectRouter.use("/:projectId/events", scrumEventRouter);
projectRouter.use("/:projectId/increments", incrementRouter);
projectRouter.use("/:projectId/notifications", notificationRouter);

projectRouter
  .route("/")
  .post(authMiddleware.verifyAdmin, uploadFiles, projectController.createProject)
  .get(projectController.getAllProjects);

projectRouter
  .route("/:projectId")
  .patch(authMiddleware.verifyAdmin, uploadFiles, projectController.updateProject)
  .delete(authMiddleware.verifyAdmin, projectController.deleteProject)
  .get(verifyProjectAccess, projectController.getProjectById);

// velocity of the team (story points done in each sprint)
projectRouter.route("/:projectId/velocity").get(verifyProjectAccess, sprintController.getVelocity);

// images and files of the project (only for the people of the project, the admin removes them)
projectRouter
  .route("/:projectId/files/:fileName")
  .get(verifyProjectAccess, projectController.getProjectFile)
  .delete(authMiddleware.verifyAdmin, projectController.deleteProjectFile);

module.exports = projectRouter;
