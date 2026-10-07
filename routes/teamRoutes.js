const express = require("express");
const teamRouter = express.Router({ mergeParams: true });
const teamController = require("../controllers/teamController");
const projectMiddleware = require("../middlewares/projectMiddleware");
const Enums = require("../constants/enums");

// the Scrum team of the project (/projects/:projectId/team) : the admin manages it, the people of the project read it
const verifyProjectAccess = projectMiddleware.verifyProjectRole(...Enums.ROLE_ENUM, "Client", "Admin");
const verifyAdmin = projectMiddleware.verifyProjectRole("Admin");

teamRouter
  .route("/")
  .post(verifyAdmin, teamController.createTeam)
  .get(verifyProjectAccess, teamController.getTeam)
  .patch(verifyAdmin, teamController.updateTeam)
  .delete(verifyAdmin, teamController.deleteTeam);

module.exports = teamRouter;
