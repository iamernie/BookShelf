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
router.get("/books", BookController.JSONgetBooks);

router.get("/books/:id", BookController.JSONgetBooks);

router.get("/genres", GenreController.JSONgetAllGenres);

router.get("/statuses", StatusController.JSONgetAllStatuses);

module.exports = router;
