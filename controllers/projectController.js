const projectService = require("../services/projectService");
const asyncHandler = require("../utils/asyncHandler");
const { saveUploadedFiles, deleteFiles, openFile } = require("../lib/fileStorage");
const { assertNoMongoOperators } = require("../middlewares/sanitizeMiddleware");

// Save the images and files sent with the request (kept in memory by multer), then run the action
// with their paths ; the saved files are deleted if the action fails (ex: invalid project)
const withUploadedFiles = async (req, action) => {
  // the multipart body is only read now (by multer)
  assertNoMongoOperators(req.body);

  const uploadedFiles = { images: [], files: [] };
  try {
    uploadedFiles.images = await saveUploadedFiles(req.files && req.files.images);
    uploadedFiles.files = await saveUploadedFiles(req.files && req.files.files);
    return await action(uploadedFiles);
  } catch (err) {
    await deleteFiles([...uploadedFiles.images, ...uploadedFiles.files]);
    throw err;
  }
};

// Create a project with its product backlog
exports.createProject = asyncHandler(async (req, res) => {
  const project = await withUploadedFiles(req, (uploadedFiles) =>
    projectService.createProject(req.body, uploadedFiles),
  );
  res.status(201).json({
    status: "success",
    message: "Project created successfully!",
    data: { project },
  });
});

// Get all the projects (the admin sees all projects, the others see their projects)
exports.getAllProjects = asyncHandler(async (req, res) => {
  const { docs: projects, pagination } = await projectService.getAllProjects(req.user, req.query);
  res.status(200).json({
    status: "success",
    results: projects.length,
    pagination,
    message: "Projects retrieved successfully!",
    data: { projects },
  });
});

// Get a project with its team, sprints and increments
exports.getProjectById = asyncHandler(async (req, res) => {
  const project = await projectService.getProjectById(req.project._id);
  res.status(200).json({
    status: "success",
    message: "Project retrieved successfully!",
    data: { project, role: req.projectRole },
  });
});

// Send an image or a file of the project (only to the people who can read the project)
exports.getProjectFile = asyncHandler(async (req, res, next) => {
  const file = await projectService.getProjectFile(req.project, req.params.fileName);

  res.set({
    // type checked against the extension at the upload
    "Content-Type": (file.metadata && file.metadata.contentType) || "application/octet-stream",
    "Content-Length": file.length,
    // the browser must not guess another type
    "X-Content-Type-Options": "nosniff",
  });
  openFile(file).on("error", next).pipe(res);
});

// The admin removes an image or a file from a project
exports.deleteProjectFile = asyncHandler(async (req, res) => {
  const project = await projectService.deleteProjectFile(req.params.projectId, req.params.fileName);
  res.status(200).json({
    status: "success",
    message: "File deleted successfully!",
    data: { project },
  });
});

// Update a project (the new files are added to the existing ones)
exports.updateProject = asyncHandler(async (req, res) => {
  const project = await withUploadedFiles(req, (uploadedFiles) =>
    projectService.updateProject(req.params.projectId, req.body, uploadedFiles),
  );
  res.status(200).json({
    status: "success",
    message: "Project updated successfully!",
    data: { project },
  });
});

// Delete a project with all its data
exports.deleteProject = asyncHandler(async (req, res) => {
  await projectService.deleteProject(req.params.projectId);
  res.status(200).json({ status: "success", message: "Project deleted successfully!" });
});
