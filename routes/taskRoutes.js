const express = require("express");
const taskRouter = express.Router({ mergeParams: true });
const taskController = require("../controllers/taskController");
const projectMiddleware = require("../middlewares/projectMiddleware");
const Enums = require("../constants/enums");

// the Sprint Backlog is a plan by and for the Developers (Scrum Guide) : only the Developers manage the tasks
const verifyScrumTeam = projectMiddleware.verifyProjectRole(...Enums.ROLE_ENUM, "Admin");
const verifyDeveloper = projectMiddleware.verifyProjectRole("Developer");

taskRouter.route("/").post(verifyDeveloper, taskController.createTask).get(verifyScrumTeam, taskController.getAllTasks);

// the tasks assigned to the logged-in user
taskRouter.route("/my-tasks").get(verifyDeveloper, taskController.getMyTasks);

taskRouter
  .route("/:id")
  .patch(verifyDeveloper, taskController.updateTask)
  .delete(verifyDeveloper, taskController.deleteTask)
  .get(verifyScrumTeam, taskController.getTaskById);

module.exports = taskRouter;
