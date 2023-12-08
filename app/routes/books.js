const express = require("express");
const router = express.Router();
const Book = require("../models/Book");
const Author = require("../models/Author");
const Series = require("../models/Series");
const Narrator = require("../models/Narrator");
const Format = require("../models/Format");
const Status = require("../models/Status");

// GET all books with related data
router.get("/", async (req, res) => {
  try {
    const books = await Book.findAll({
      include: [Author, Series, Narrator, Format, Status],
    });
    res.render("books/books", { books });
  } catch (error) {
    console.error("Error fetching books:", error);
    res.status(500).send("Error occurred while fetching books");
  }
});

// GET all books with related data
router.get("/debug", async (req, res) => {
  try {
    const books = await Book.findAll({
      include: [Author, Series, Narrator, Format, Status],
    });
    res.render("books/debug", { books });
  } catch (error) {
    console.error("Error fetching books:", error);
    res.status(500).send("Error occurred while fetching books");
  }
});

// GET the form for adding a new book
router.get("/add", async (req, res) => {
  try {
    const authors = await Author.findAll();
    const series = await Series.findAll();
    const narrators = await Narrator.findAll();
    const formats = await Format.findAll();
    const statuses = await Status.findAll();
    res.render("books/addBook", {
      authors,
      series,
      narrators,
      formats,
      statuses,
    });
  } catch (error) {
    console.error("Error fetching data for adding book:", error);
    res.status(500).send("Error occurred while preparing to add a book");
  }
});

// POST a new book
router.post("/", async (req, res) => {
  try {
    const {
      title,
      authorId,
      seriesId,
      narratorId,
      coverImageUrl,
      formatId,
      statusId,
    } = req.body;
    const newBook = await Book.create({
      title,
      authorId: authorId || null,
      seriesId: seriesId || null,
      narratorId: narratorId || null,
      coverImageUrl,
      formatId: formatId || null,
      statusId: statusId || null,
    });

    res.redirect("/books");
  } catch (error) {
    console.error("Error creating book:", error);
    res.status(500).send("Error occurred while creating a book");
  }
});

// GET the form for editing a book
router.get("/edit/:id", async (req, res) => {
  try {
    const book = await Book.findByPk(req.params.id, {
      include: [
        { model: Author },
        { model: Series },
        { model: Narrator },
        { model: Format },
        { model: Status },
      ],
    });
    const authors = await Author.findAll();
    const series = await Series.findAll();
    const narrators = await Narrator.findAll();
    const formats = await Format.findAll();
    const statuses = await Status.findAll();
    if (book) {
      res.render("books/editBook", {
        book,
        authors,
        series,
        narrators,
        formats,
        statuses,
      });
    } else {
      res.status(404).send("Book not found");
    }
  } catch (error) {
    console.error("Error fetching book for edit:", error);
    res.status(500).send("Server error");
  }
});

// PUT (update) a book
router.put("/:id", async (req, res) => {
  try {
    const {
      title,
      authorId,
      seriesId,
      narratorId,
      coverImageUrl,
      formatId,
      statusId,
    } = req.body;
    const book = await Book.findByPk(req.params.id);

    await book.update({
      title,
      authorId: authorId || null,
      seriesId: seriesId || null,
      narratorId: narratorId || null,
      coverImageUrl,
      formatId: formatId || null,
      statusId: statusId || null,
    });

    res.redirect("/books");
  } catch (error) {
    console.error("Error updating book:", error);
    res.status(500).send("Error occurred while updating the book");
  }
});

// DELETE a book
router.delete("/:id", async (req, res) => {
  try {
    await Book.destroy({ where: { id: req.params.id } });
    res.redirect("/books");
  } catch (error) {
    console.error("Error deleting book:", error);
    res.status(500).send("Error occurred while deleting the book");
  }
});

module.exports = router;
