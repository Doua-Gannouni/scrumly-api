const express = require("express");
const userRouter = express.Router();
const userController = require("../controllers/userController");
const authController = require("../controllers/authController");
const authMiddleware = require("../middlewares/authMiddleware");

// route to get the list of the users
userRouter.route("/").get(authMiddleware.verifyAdmin, userController.getAllUsers);

// route to get the profile of the logged-in user
userRouter.route("/me").get(authMiddleware.verifyAuthentication, userController.getMyProfile);

// the registration requests : the admin lists them,
// accepts (accepted: true) or refuses them (accepted: false, the account is deleted)
userRouter.route("/registration-requests").get(authMiddleware.verifyAdmin, userController.getRegistrationRequests);

userRouter.route("/:id/registration").patch(authMiddleware.verifyAdmin, userController.handleRegistrationRequest);

// the logged-in user changes their password
userRouter.route("/me/password").patch(authMiddleware.verifyAuthentication, authController.changePassword);

// the admin manages the accounts (a deactivated user is logged out at once)
userRouter.route("/:id").delete(authMiddleware.verifyAdmin, userController.deleteUser);

userRouter.route("/:id/activate").patch(authMiddleware.verifyAdmin, userController.activateUser);

userRouter.route("/:id/deactivate").patch(authMiddleware.verifyAdmin, userController.deactivateUser);

module.exports = userRouter;
