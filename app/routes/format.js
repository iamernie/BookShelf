const express = require("express");
const router = express.Router();
const Format = require("../models/Format"); // Adjust the path as necessary
const FormatController = require("../controllers/formatController");

// GET all formats
router.get("/", FormatController.getAllFormats);

// GET the form for adding a new format
router.get("/add", (req, res) => {
  res.render("formats/addFormat");
});

// POST a new format
router.post("/", FormatController.postNewFormat);

// GET the form for editing a format
router.get("/edit/:id", FormatController.getEditFormat);
// PUT (update) a format
router.put("/:id", FormatController.putEditFormat);

// DELETE a format
router.delete("/:id", FormatController.deleteFormat);

module.exports = router;
