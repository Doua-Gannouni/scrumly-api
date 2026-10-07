const express = require("express");
const incrementRouter = express.Router({ mergeParams: true });
const incrementController = require("../controllers/incrementController");
const projectMiddleware = require("../middlewares/projectMiddleware");
const Enums = require("../constants/enums");

// an increment is born when a user story meets the Definition of Done, the Product Owner delivers it
const verifyProjectAccess = projectMiddleware.verifyProjectRole(...Enums.ROLE_ENUM, "Client", "Admin");
const verifyProductOwner = projectMiddleware.verifyProjectRole("ProductOwner");

incrementRouter.route("/").get(verifyProjectAccess, incrementController.getAllIncrements);

incrementRouter
  .route("/:id")
  .patch(verifyProductOwner, incrementController.updateIncrement)
  .get(verifyProjectAccess, incrementController.getIncrementById);

incrementRouter.route("/:id/deliver").post(verifyProductOwner, incrementController.deliverIncrement);

module.exports = incrementRouter;
