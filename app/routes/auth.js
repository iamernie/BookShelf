const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const passport = require("passport");

const User = require("../models/User"); // Adjust the path to your User model

// Register Route
router.get("/register", (req, res) => {
  res.render("register"); // Ensure you have a view template for registration
});

router.post("/register", async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const user = await User.create({
      username: req.body.username,
      email: req.body.email,
      password: hashedPassword,
      role: "user", // Default role
    });
    res.redirect("/login");
  } catch {
    res.redirect("/register");
  }
});

// Login Route
router.get("/login", (req, res) => {
  const messages = req.flash("error");
  res.render("login", { messages }); // Ensure you have a view template for login
});

router.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login",
    failureFlash: "Invalid username or password.", // Set a custom flash message
  })
);

// Logout Route
router.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/login");
  });
});

module.exports = router;
