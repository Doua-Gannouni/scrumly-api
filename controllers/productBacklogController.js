const productBacklogService = require("../services/productBacklogService");
const reportService = require("../services/reportService");
const asyncHandler = require("../utils/asyncHandler");

// Get the product backlog : user stories not done and not selected in a sprint, ordered by priority
exports.getProductBacklog = asyncHandler(async (req, res) => {
  const { productBacklog, definitionOfDone, userStories } = await productBacklogService.getProductBacklog(req.project);
  res.status(200).json({
    status: "success",
    results: userStories.length,
    message: "Product backlog retrieved successfully!",
    data: { productBacklog, definitionOfDone, userStories },
  });
});

// The Product Owner updates the product backlog (name, description, Product Goal)
exports.updateProductBacklog = asyncHandler(async (req, res) => {
  const productBacklog = await productBacklogService.updateProductBacklog(req.project, req.body);
  res.status(200).json({
    status: "success",
    message: "Product backlog updated successfully!",
    data: { productBacklog },
  });
});

// Close the current Product Goal (fulfilled or abandoned)
const closeProductGoal = (status) =>
  asyncHandler(async (req, res) => {
    const productBacklog = await productBacklogService.closeProductGoal(req.project, status);
    res.status(200).json({
      status: "success",
      message: `Product Goal ${status.toLowerCase()} successfully!`,
      data: { productBacklog },
    });
  });

// The Product Owner marks the Product Goal as fulfilled
exports.fulfillProductGoal = closeProductGoal("Fulfilled");

// The Product Owner abandons the Product Goal
exports.abandonProductGoal = closeProductGoal("Abandoned");

// Export the product backlog as a PDF file (sent directly in the response)
exports.generatePdf = asyncHandler(async (req, res) => {
  const { productBacklog, userStories } = await productBacklogService.getBacklogReport(req.project);
  res.attachment("ProductBacklog.pdf");
  reportService.writeProductBacklogPdf(res, req.project.name, productBacklog, userStories);
});

// Export the product backlog as an Excel file (sent directly in the response)
exports.generateExcel = asyncHandler(async (req, res) => {
  const { productBacklog, userStories } = await productBacklogService.getBacklogReport(req.project);
  res.attachment("ProductBacklog.xlsx");
  await reportService.writeProductBacklogExcel(res, req.project.name, productBacklog, userStories);
});
