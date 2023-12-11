const express = require("express");
const router = express.Router();
const Status = require("../models/Status"); // Adjust the path as necessary

// GET all status as JSON
router.get("/", async (req, res) => {
  try {
    const statuses = await Status.findAll({
      order: [["name", "ASC"]],
    });
    res.json(statuses); // Send the statuses as JSON
  } catch (error) {
    console.error("Error fetching statuses:", error);
    res.status(500).send("Error occurred while fetching statuses");
  }
});

// GET all status in a view
router.get("/list", async (req, res) => {
  try {
    const status = await Status.findAll();
    res.render("status/listStatuses", { status });
  } catch (error) {
    console.error("Error fetching statuses:", error);
    res.status(500).send("Error occurred while fetching statuses");
  }
});

// GET the form for adding a new status
router.get("/add", (req, res) => {
  res.render("status/addStatus");
});

// POST a new status
router.post("/", async (req, res) => {
  try {
    const { name } = req.body; // Adjust according to your fields
    await Status.create({ name });
    res.redirect("/status");
  } catch (error) {
    console.error("Error creating status:", error);
    res.status(500).send("Error occurred while creating a status");
  }
});

// GET the form for editing a status
router.get("/edit/:id", async (req, res) => {
  try {
    const status = await Status.findByPk(req.params.id);
    if (status) {
      res.render("status/editStatus", { status });
    } else {
      res.status(404).send("Status not found");
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Server error");
  }
});

// PUT (update) a status
router.put("/:id", async (req, res) => {
  try {
    const { name } = req.body; // Adjust according to your fields
    await Status.update(
      { name },
      {
        where: { id: req.params.id },
      }
    );
    res.redirect("/status");
  } catch (error) {
    console.error("Error updating status:", error);
    res.status(500).send("Error occurred while updating the status");
  }
});

// DELETE a status
router.delete("/:id", async (req, res) => {
  try {
    await Status.destroy({
      where: { id: req.params.id },
    });
    res.redirect("/status");
  } catch (error) {
    console.error("Error deleting status:", error);
    res.status(500).send("Error occurred while deleting the status");
  }
});

module.exports = router;
