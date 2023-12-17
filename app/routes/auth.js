const express = require("express");
const router = express.Router();
const passport = require("passport");

const authController = require("../controllers/authController");

// Register Route
router.get("/register", authController.getRegisterUser);

router.post("/register", authController.postRegisterUser);

// Login Route
router.get("/login", authController.getLogin);

router.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login",
    failureFlash: "Invalid username or password.", // Set a custom flash message
  })
);

// Logout Route
router.get("/logout", authController.getLogout);

module.exports = router;
