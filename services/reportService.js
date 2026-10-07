const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

const COLUMNS = ["Priority", "Title", "Story points", "Status", "Sprint"];

// Values of a row of the table (0 is a valid value)
const getUserStoryRow = (userStory) => [
  userStory.priority != null ? userStory.priority.toString() : "N/A",
  userStory.title || "Unknown title",
  userStory.storyPoints != null ? userStory.storyPoints.toString() : "N/A",
  userStory.status || "Unknown status",
  userStory.sprint ? userStory.sprint.name : "Product backlog",
];

// Write the product backlog as a PDF document in the stream (ex: the HTTP response)
exports.writeProductBacklogPdf = (stream, projectName, productBacklog, userStories) => {
  const doc = new PDFDocument();
  doc.pipe(stream);

  // Title of the document
  doc.fontSize(16).font("Helvetica-Bold").text(`Product Backlog: ${projectName}`, { align: "center" });
  doc
    .fontSize(12)
    .font("Helvetica")
    .text(productBacklog.description || "No description", { align: "center" });
  if (productBacklog.productGoal) {
    doc.moveDown(0.5);
    doc.font("Helvetica-Oblique").text(`Product Goal: ${productBacklog.productGoal}`, { align: "center" });
    doc.font("Helvetica");
  }
  doc.moveDown();

  // Table configuration
  const headerX = 50;
  const headerY = Math.max(doc.y + 10, 150);
  const columnWidths = [60, 220, 70, 80, 110]; // Column widths
  const tableWidth = columnWidths.reduce((a, b) => a + b, 0);
  const getColumnX = (index) => headerX + columnWidths.slice(0, index).reduce((acc, curr) => acc + curr, 0);

  // Draw the headers of the table (returns the position of the first row)
  const drawHeader = (y) => {
    doc.fontSize(12).font("Helvetica-Bold");
    COLUMNS.forEach((column, index) => {
      doc.text(column, getColumnX(index), y, { width: columnWidths[index], align: "center" });
    });

    // Separator line after the headers
    doc
      .moveTo(headerX, y + 15)
      .lineTo(headerX + tableWidth, y + 15)
      .stroke();

    doc.font("Helvetica");
    return y + 25;
  };

  // Fill the table with the user stories
  let y = drawHeader(headerY);
  userStories.forEach((userStory) => {
    const rowData = getUserStoryRow(userStory);

    // Height of the row depends on the longest text (ex: title on several lines)
    const rowHeight = Math.max(
      ...rowData.map((data, index) => doc.heightOfString(data, { width: columnWidths[index] })),
    );

    // New page if the row goes beyond the bottom of the page
    if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = drawHeader(doc.page.margins.top);
    }

    rowData.forEach((data, index) => {
      doc.text(data, getColumnX(index), y, { width: columnWidths[index], align: "center", continued: false });
    });

    // Separator line after each row
    doc
      .moveTo(headerX, y + rowHeight + 2)
      .lineTo(headerX + tableWidth, y + rowHeight + 2)
      .stroke();

    y += rowHeight + 7; // Space between the rows
  });

  // End the PDF (the stream ends with the document)
  doc.end();
};

// Write the product backlog as an Excel file in the stream (ex: the HTTP response)
exports.writeProductBacklogExcel = async (stream, projectName, productBacklog, userStories) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Product Backlog");

  // Title of the document
  worksheet.mergeCells("A1:E1");
  worksheet.getCell("A1").value = `Product Backlog: ${projectName}`;
  worksheet.getCell("A1").style = { font: { size: 16, bold: true }, alignment: { horizontal: "center" } };

  // Product Goal of the backlog
  worksheet.mergeCells("A2:E2");
  worksheet.getCell("A2").value = productBacklog.productGoal
    ? `Product Goal: ${productBacklog.productGoal}`
    : productBacklog.description;
  worksheet.getCell("A2").style = { font: { size: 12 }, alignment: { horizontal: "center" } };
  worksheet.addRow([]); // Empty row

  // Column headers
  const headerRow = worksheet.addRow(COLUMNS);
  headerRow.font = { bold: true };

  // Column widths
  [10, 60, 14, 14, 20].forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width;
  });

  // Fill the table with the user stories
  userStories.forEach((userStory) => {
    worksheet.addRow(getUserStoryRow(userStory));
  });

  await workbook.xlsx.write(stream);
  stream.end();
};
