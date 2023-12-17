const bcrypt = require("bcrypt");
const User = require("../models/User"); // Update with the correct path

// Middleware to check if the user is an admin
exports.isAdmin = function (req, res, next) {
  if (req.isAuthenticated() && req.user.role === "admin") {
    return next();
  }
  res.redirect("/login");
};

exports.getAdminUsers = async (req, res) => {
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
};

exports.getAddAdmin = (req, res) => {
  res.render("admin/addUser");
};

exports.getEditAdmin = async (req, res) => {
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
};

exports.postAddAdmin = async (req, res) => {
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
};

exports.postEditAdmin = async (req, res) => {
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
};

exports.deleteAdmin = async (req, res) => {
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
};
