const express = require("express");
const router = express.Router();
const Author = require("../models/Author"); // Adjust the path as necessary

// GET all authors
router.get("/", async (req, res) => {
  try {
    const authors = await Author.findAll();
    res.render("authors/listAuthors", { authors });
  } catch (error) {
    console.error("Error fetching authors:", error);
    res.status(500).send("Error occurred while fetching authors");
  }
});

// GET the form for adding a new author
router.get("/add", (req, res) => {
  res.render("authors/addAuthor");
});

// POST a new author
router.post("/", async (req, res) => {
  try {
    const { name } = req.body; // Adjust according to your fields
    await Author.create({ name });
    res.redirect("/authors");
  } catch (error) {
    console.error("Error creating author:", error);
    res.status(500).send("Error occurred while creating an author");
  }
});

// GET the form for editing an author
router.get("/edit/:id", async (req, res) => {
  try {
    const author = await Author.findByPk(req.params.id);
    if (author) {
      res.render("authors/editAuthor", { author });
    } else {
      res.status(404).send("Author not found");
    }
  } catch (error) {
    console.error("Error fetching author:", error);
    res.status(500).send("Error occurred while fetching the author");
  }
});

// PUT (update) an author
router.put("/:id", async (req, res) => {
  try {
    const { name } = req.body; // Adjust according to your fields
    const updated = await Author.update(
      { name },
      {
        where: { id: req.params.id },
      }
    );

    if (updated) {
      res.redirect("/authors");
    } else {
      res.status(404).send("Author not found");
    }
  } catch (error) {
    console.error("Error updating author:", error);
    res.status(500).send("Error occurred while updating the author");
  }
});

// DELETE an author
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Author.destroy({
      where: { id: req.params.id },
    });

    if (deleted) {
      res.redirect("/authors");
    } else {
      res.status(404).send("Author not found");
    }
  } catch (error) {
    console.error("Error deleting author:", error);
    res.status(500).send("Error occurred while deleting the author");
  }
});

module.exports = router;
