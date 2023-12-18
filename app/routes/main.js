const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.redirect("/books"); // Redirect to the books route
});

module.exports = router;
