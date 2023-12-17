const express = require("express");
const router = express.Router();
const BookController = require("../controllers/bookController");
const GenreController = require("../controllers/genreController");
const StatusController = require("../controllers/statusController");

const Book = require("../models/Book");
const Author = require("../models/Author");
const Series = require("../models/Series");
const Narrator = require("../models/Narrator");

// GET all books
router.get("/books", BookController.JSONgetAllBooks);

router.get("/genres", GenreController.JSONgetAllGenres);

router.get("/statuses", StatusController.JSONgetAllStatuses);

// GET a single book by ID
//router.get("/books/:id", BookController.getBookById);

// POST a new book
//router.post('/books', BookController.createBook);

// PUT update a book
//router.put('/books/:id', BookController.updateBook);

// DELETE a book
//router.delete('/books/:id', BookController.deleteBook);

module.exports = router;
