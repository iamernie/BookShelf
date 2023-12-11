const express = require("express");
const router = express.Router();
const Series = require("../models/Series"); // Adjust the path as necessary
const Book = require("../models/Book"); // Make sure this path is correct
const Author = require("../models/Author"); // Import if you're using the Author model
const Status = require("../models/Status"); //
const Narrator = require("../models/Narrator");

// GET all series
router.get("/", async (req, res) => {
  try {
    const series = await Series.findAll({
      order: [["title", "ASC"]],
    });
    res.render("series/listSeries", { series });
  } catch (error) {
    res.status(500).send("Error occurred: " + error.message);
  }
});

router.get("/details/:id", async (req, res) => {
  try {
    const series = await Series.findByPk(req.params.id);
    if (!series) {
      return res.status(404).send("Series not found");
    }
    res.json(series);
  } catch (error) {
    res.status(500).send("Server error");
  }
});

// GET all books in a series
router.get("/:id/books", async (req, res) => {
  try {
    const seriesId = req.params.id;
    const books = await Book.findAll({
      where: { seriesId: seriesId },
      include: [Series, Author, Status, Narrator], // Include other related models as needed
      order: [["bookNum", "DESC"]],
    });
    const series = await Series.findByPk(seriesId);
    res.render("series/seriesBooks", { books, seriesId, series }); // Render a view with the books in the series
  } catch (error) {
    console.error("Error fetching books by series:", error);
    res.status(500).send("Error occurred while fetching books");
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

// Update Series notes
// In your series routes file
router.put("/:seriesId/update-notes", async (req, res) => {
  try {
    const seriesId = req.params.seriesId;
    const { comments } = req.body;

    const series = await Series.findByPk(seriesId);
    if (!series) {
      return res.status(404).send("Series not found");
    }

    await series.update({ comments });
    res.send("Series notes updated successfully");
  } catch (error) {
    console.error("Error updating series notes:", error);
    res.status(500).send("Error updating series notes");
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
