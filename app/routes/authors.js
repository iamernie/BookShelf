const express = require("express");
const router = express.Router();
const Author = require("../models/Author"); // Adjust the path as necessary
const Status = require("../models/Status"); //
const Narrator = require("../models/Narrator");
const Series = require("../models/Series"); // Adjust the path as necessary
const Book = require("../models/Book"); // Make sure this path is correct
const { getStatsAuthor } = require("../controllers/statsController"); // Adjust the path

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

// GET all books by an author
router.get("/:id/books", async (req, res) => {
  try {
    const authorId = req.params.id;
    const stats = await getStatsAuthor(authorId);
    const books = await Book.findAll({
      where: { authorId: authorId },
      include: [Series, Author, Status, Narrator], // Include other related models as needed
      order: [["title", "ASC"]],
    });
    const author = await Author.findByPk(authorId);
    books.forEach((book) => {
      book.fromAuthor = true; // Add this line
    });

    res.render("authors/authorBooks", {
      books,
      authorId,
      author,
      stats: stats,
    }); // Render a view with the books in the series
  } catch (error) {
    console.error("Error fetching books by author:", error);
    res.status(500).send("Error occurred while fetching books");
  }
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
