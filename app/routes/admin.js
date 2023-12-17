const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");

// GET - Display all users (with basic pagination)
router.get("/users", adminController.isAdmin, adminController.getAdminUsers);

// GET - Show form to add a new user
router.get("/users/add", adminController.isAdmin, adminController.getAddAdmin);

// GET - Show form to edit a user
router.get(
  "/users/edit/:id",
  adminController.isAdmin,
  adminController.getEditAdmin
);

// POST - Add a new user
router.post(
  "/users/add",
  adminController.isAdmin,
  adminController.postAddAdmin
);

// POST - Update a user
router.post(
  "/users/edit/:id",
  adminController.isAdmin,
  adminController.postEditAdmin
);

// POST - Delete a user
router.post(
  "/users/delete/:id",
  adminController.isAdmin,
  adminController.deleteAdmin
);

module.exports = router;
