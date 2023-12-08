const express = require("express");
const router = express.Router();
const Format = require("../models/Format"); // Adjust the path as necessary

// GET all formats
router.get("/", async (req, res) => {
  try {
    const formats = await Format.findAll();
    res.render("formats/listFormats", { formats });
  } catch (error) {
    console.error("Error fetching formats:", error);
    res.status(500).send("Error occurred while fetching formats");
  }
});

// GET the form for adding a new format
router.get("/add", (req, res) => {
  res.render("formats/addFormat");
});

// POST a new format
router.post("/", async (req, res) => {
  try {
    const { name } = req.body; // Adjust according to your fields
    await Format.create({ name });
    res.redirect("/formats");
  } catch (error) {
    console.error("Error creating format:", error);
    res.status(500).send("Error occurred while creating a format");
  }
});

// GET the form for editing a format
router.get("/edit/:id", async (req, res) => {
  try {
    const format = await Format.findByPk(req.params.id);
    if (format) {
      res.render("formats/editFormat", { format });
    } else {
      res.status(404).send("Format not found");
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Server error");
  }
});

// PUT (update) a format
router.put("/:id", async (req, res) => {
  try {
    const { name } = req.body; // Adjust according to your fields
    await Format.update(
      { name },
      {
        where: { id: req.params.id },
      }
    );
    res.redirect("/formats");
  } catch (error) {
    console.error("Error updating format:", error);
    res.status(500).send("Error occurred while updating the format");
  }
});

// DELETE a format
router.delete("/:id", async (req, res) => {
  try {
    await Format.destroy({
      where: { id: req.params.id },
    });
    res.redirect("/formats");
  } catch (error) {
    console.error("Error deleting format:", error);
    res.status(500).send("Error occurred while deleting the format");
  }
});

module.exports = router;
