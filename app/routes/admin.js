const express = require("express");
const bcrypt = require("bcrypt");
const User = require("../models/User"); // Update with the correct path
const router = express.Router();

// Middleware to check if the user is an admin
function isAdmin(req, res, next) {
  if (req.isAuthenticated() && req.user.role === "admin") {
    return next();
  }
  res.redirect("/login");
}

// GET - Display all users (with basic pagination)
router.get("/users", isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10; // Number of records per page
    const offset = (page - 1) * limit;
    const users = await User.findAndCountAll({ limit: limit, offset: offset });

    res.render("admin/users", {
      users: users.rows,
      currentPage: page,
      totalPages: Math.ceil(users.count / limit),
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error retrieving users");
  }
});

// GET - Show form to add a new user
router.get("/users/add", isAdmin, (req, res) => {
  res.render("admin/addUser");
});

// POST - Add a new user
router.post("/users/add", isAdmin, async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    await User.create({
      username: req.body.username,
      email: req.body.email,
      password: hashedPassword,
      role: req.body.role,
    });
    res.redirect("/admin/users");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error creating user");
  }
});

// GET - Show form to edit a user
router.get("/users/edit/:id", isAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (user) {
      res.render("admin/editUser", { user });
    } else {
      res.status(404).send("User not found");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching user");
  }
});

// POST - Update a user
router.post("/users/edit/:id", isAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (user) {
      const hashedPassword = req.body.password
        ? await bcrypt.hash(req.body.password, 10)
        : user.password;
      await user.update({
        username: req.body.username,
        email: req.body.email,
        password: hashedPassword,
        role: req.body.role,
      });
      res.redirect("/admin/users");
    } else {
      res.status(404).send("User not found");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Error updating user");
  }
});

// POST - Delete a user
router.post("/users/delete/:id", isAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (user) {
      await user.destroy();
      res.redirect("/admin/users");
    } else {
      res.status(404).send("User not found");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Error deleting user");
  }
});

module.exports = router;
