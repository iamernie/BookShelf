const express = require("express");
const router = express.Router();
const Series = require("../models/Series"); // Adjust the path as necessary

// GET all series
router.get("/", async (req, res) => {
  try {
    const series = await Series.findAll();
    res.render("series/listSeries", { series });
  } catch (error) {
    res.status(500).send("Error occurred: " + error.message);
  }
});

// GET the form for adding a new series
router.get("/add", (req, res) => {
  res.render("series/addSeries");
});

// POST a new series
router.post("/", async (req, res) => {
  try {
    const { title, description } = req.body;
    await Series.create({ title, description });
    res.redirect("/series");
  } catch (error) {
    res.status(500).send("Error occurred: " + error.message);
  }
});

// GET the form for editing a series
router.get("/edit/:id", async (req, res) => {
  try {
    const series = await Series.findByPk(req.params.id);
    if (series) {
      res.render("series/editSeries", { series });
    } else {
      res.status(404).send("Series not found");
    }
  } catch (error) {
    res.status(500).send("Error occurred: " + error.message);
  }
});

// PUT (update) a series
router.put("/:id", async (req, res) => {
  try {
    const { title, description } = req.body;
    await Series.update(
      { title, description },
      {
        where: { id: req.params.id },
      }
    );
    res.redirect("/series");
  } catch (error) {
    res.status(500).send("Error occurred: " + error.message);
  }
});

// DELETE a series
router.delete("/:id", async (req, res) => {
  try {
    await Series.destroy({
      where: { id: req.params.id },
    });
    res.redirect("/series");
  } catch (error) {
    res.status(500).send("Error occurred: " + error.message);
  }
});

module.exports = router;
