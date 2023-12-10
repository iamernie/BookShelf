const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/User'); // Adjust the path as needed
const router = express.Router();

// Middleware to check if the user is an admin
function isAdmin(req, res, next) {
  if (req.isAuthenticated() && req.user.role === 'admin') {
    return next();
  }
  res.redirect('/login');
}

// List users with pagination
router.get('/users', async (req, res) => {
  try {
    const users = await User.findAll(); // Add pagination logic
    res.render('adminUsers', { users });
  } catch (err) {
    console.error(err);
    res.redirect('/admin/users');
  }
});

// Add new user form
router.get('/users/add', isAdmin, (req, res) => {
  res.render('adminAddUser');
});

// Add new user logic
router.post('/users/add', isAdmin, async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    await User.create({ /* user data from req.body */ });
    res.redirect('/admin/users');
  } catch (err) {
    console.error(err);
    res.redirect('/admin/users/add');
  }
});

// Edit user form
router.get('/users/edit/:id', isAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    res.render('adminEditUser', { user });
  } catch (err) {
    console.error(err);
    res.redirect('/admin/users');
  }
});

// Edit user logic
router.post('/users/edit/:id', isAdmin, async (req, res) => {
  try {
    // Update user logic here
    res.redirect('/admin/users');
  } catch (err) {
    console.error(err);
    res.redirect('/admin/users');
  }
});

// Delete user
router.post('/users/delete/:id', isAdmin, async (req, res) => {
  try {
    await User.destroy({ where: { id: req.params.id } });
    res.redirect('/admin/users');
  } catch (err) {
    console.error(err);
    res.redirect('/admin/users');
  }
});

module.exports = router;
