const express = require("express");
const scrumEventRouter = express.Router({ mergeParams: true });
const scrumEventController = require("../controllers/scrumEventController");
const projectMiddleware = require("../middlewares/projectMiddleware");
const Enums = require("../constants/enums");

// the Scrum Master makes sure the events take place, the Scrum team, the client and the admin can read them
const verifyProjectAccess = projectMiddleware.verifyProjectRole(...Enums.ROLE_ENUM, "Client", "Admin");
const verifyScrumMaster = projectMiddleware.verifyProjectRole("ScrumMaster");

scrumEventRouter
  .route("/")
  .post(verifyScrumMaster, scrumEventController.createEvent)
  .get(verifyProjectAccess, scrumEventController.getAllEvents);

scrumEventRouter
  .route("/:id")
  .patch(verifyScrumMaster, scrumEventController.updateEvent)
  .delete(verifyScrumMaster, scrumEventController.deleteEvent)
  .get(verifyProjectAccess, scrumEventController.getEventById);

module.exports = scrumEventRouter;
