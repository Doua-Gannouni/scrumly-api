const express = require("express");
const memberRouter = express.Router({ mergeParams: true });
const memberController = require("../controllers/memberController");
const projectMiddleware = require("../middlewares/projectMiddleware");
const Enums = require("../constants/enums");

// the members of the team of the project (/projects/:projectId/team/members) with their Scrum role :
// the admin manages them, the people of the project read them
const verifyProjectAccess = projectMiddleware.verifyProjectRole(...Enums.ROLE_ENUM, "Client", "Admin");
const verifyAdmin = projectMiddleware.verifyProjectRole("Admin");

memberRouter
  .route("/")
  .get(verifyProjectAccess, memberController.getMembers)
  .post(verifyAdmin, memberController.addMember);

memberRouter
  .route("/:id")
  .patch(verifyAdmin, memberController.updateMember)
  .delete(verifyAdmin, memberController.deleteMember);

module.exports = memberRouter;
