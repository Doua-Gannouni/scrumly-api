const projectService = require("../services/projectService");
const asyncHandler = require("../utils/asyncHandler");

// Check that the logged-in user has one of the allowed roles in the project of the route (/projects/:projectId/...)
// used after verifyAuthentication ; the rules are in projectService.checkProjectAccess
exports.verifyProjectRole = (...allowedRoles) =>
  asyncHandler(async (req, res, next) => {
    const isReadOnly = ["GET", "HEAD"].includes(req.method);
    const { project, role } = await projectService.checkProjectAccess(
      req.params.projectId,
      req.user,
      allowedRoles,
      isReadOnly,
    );

    req.project = project;
    req.projectRole = role;
    next();
  });
