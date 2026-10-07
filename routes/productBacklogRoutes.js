const express = require("express");
const productBacklogRouter = express.Router({ mergeParams: true });
const productBacklogController = require("../controllers/productBacklogController");
const projectMiddleware = require("../middlewares/projectMiddleware");
const Enums = require("../constants/enums");

// the Scrum team, the client and the admin can read the product backlog, the Product Owner manages it
const verifyProjectAccess = projectMiddleware.verifyProjectRole(...Enums.ROLE_ENUM, "Client", "Admin");
const verifyProductOwner = projectMiddleware.verifyProjectRole("ProductOwner");

productBacklogRouter
  .route("/")
  .get(verifyProjectAccess, productBacklogController.getProductBacklog)
  .patch(verifyProductOwner, productBacklogController.updateProductBacklog);

// one Product Goal at a time : fulfilled or abandoned before taking on the next one
productBacklogRouter
  .route("/product-goal/fulfill")
  .post(verifyProductOwner, productBacklogController.fulfillProductGoal);

productBacklogRouter
  .route("/product-goal/abandon")
  .post(verifyProductOwner, productBacklogController.abandonProductGoal);

productBacklogRouter.route("/pdf").get(verifyProjectAccess, productBacklogController.generatePdf);

productBacklogRouter.route("/excel").get(verifyProjectAccess, productBacklogController.generateExcel);

module.exports = productBacklogRouter;
