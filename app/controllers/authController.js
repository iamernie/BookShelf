const bcrypt = require("bcrypt");
const User = require("../models/User"); // Adjust the path to your User model

exports.getRegisterUser = (req, res) => {
  res.render("register"); // Ensure you have a view template for registration
};

exports.getLogin = (req, res) => {
  const messages = req.flash("error");
  res.render("login", { messages }); // Ensure you have a view template for login
};

exports.getLogout = (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/login");
  });
};

exports.postRegisterUser = async (req, res) => {
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
};
