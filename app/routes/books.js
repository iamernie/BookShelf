const express = require("express");
const router = express.Router();
const multer = require("multer");
const slugify = require("slugify");
const bookController = require("../controllers/bookController");

const Book = require("../models/Book");
const Author = require("../models/Author");
const Series = require("../models/Series");
const Narrator = require("../models/Narrator");
const Format = require("../models/Format");
const Status = require("../models/Status");

// Custom storage engine
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const { title, seriesId, bookNum } = req.body;
    const fileExtension = file.originalname.split(".").pop();
    const slugTitle = slugify(title || "", { lower: true, strict: true });
    const slugSeriesId = slugify(seriesId || "", { lower: true, strict: true });

    cb(null, `${slugTitle}_${slugSeriesId}_${bookNum}.${fileExtension}`);
  },
});

const upload = multer({ storage: storage });

router.get("/", bookController.searchBooks);
router.get("/grid", bookController.getBooksGrid);
router.get("/filter", bookController.filterBooksByStatus);

router.put("/:bookId/update-rating", async (req, res) => {
  try {
    const bookId = req.params.bookId;
    const { rating } = req.body; // Make sure the rating is passed in the request body

    // Find the book by ID
    const book = await Book.findByPk(bookId);
    if (!book) {
      return res.status(404).send("Book not found");
    }

    // Update the book's rating
    await book.update({ rating });

    // Send a success response
    res.json({ message: "Rating updated successfully" });
  } catch (error) {
    console.error("Error updating book rating:", error);
    res.status(500).send("Error occurred while updating the book rating");
  }
});

// Update the status and potentially the completedDate of a book
router.put("/:bookId/update-status", async (req, res) => {
  try {
    const { statusId } = req.body;
    const bookId = req.params.bookId;

    const book = await Book.findByPk(bookId);
    if (!book) {
      return res.status(404).send("Book not found");
    }

    // Assuming '2' is the ID for the 'Read' status
    const completedDate = statusId === "2" ? new Date() : null;

    await book.update({
      statusId: statusId,
      ...(completedDate ? { completedDate: completedDate } : {}),
    });

    res.send("Status and completion date updated successfully");
  } catch (error) {
    console.error("Error updating book status:", error);
    res.status(500).send("Error occurred while updating book status");
  }
});

router.put("/:bookId/update-notes", async (req, res) => {
  try {
    const bookId = req.params.bookId;
    const { notes } = req.body;

    const book = await Book.findByPk(bookId);
    if (book) {
      await book.update({ comments: notes });
      res.send("Book notes updated successfully");
    } else {
      res.status(404).send("Book not found");
    }
  } catch (error) {
    console.error("Error updating book notes:", error);
    res.status(500).send("Error occurred while updating book notes");
  }
});

// Add this new route for fetching detailed book data
router.get("/details/:bookId", async (req, res) => {
  try {
    const bookId = req.params.bookId;
    const book = await Book.findByPk(bookId, {
      include: [Author, Series, Narrator, Format, Status],
    });

    if (book) {
      res.json(book);
    } else {
      res.status(404).send("Book not found");
    }
  } catch (error) {
    console.error("Error fetching book details:", error);
    res.status(500).send("Error fetching book details");
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
    const authors = await Author.findAll({
      order: [["name", "ASC"]],
    });
    const series = await Series.findAll({
      order: [["title", "ASC"]],
    });
    const narrators = await Narrator.findAll({
      order: [["name", "ASC"]],
    });
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

// POST a new book, with upload.single() middleware to handle the file upload
router.post("/", upload.single("coverImageFile"), async (req, res) => {
  try {
    const {
      title,
      authorId,
      seriesId,
      narratorId,
      formatId,
      statusId,
      summary,
      startReadingDate,
      completedDate,
      rating,
      bookNum,
    } = req.body;

    let coverImageUrl = req.body.coverImageUrl;

    // If a file is uploaded, use the file's path instead of the cover image URL
    if (req.file) {
      coverImageUrl = `/uploads/${req.file.filename}`; // Adjust the path based on your static files configuration
    }

    const newBook = await Book.create({
      title,
      authorId: authorId || null,
      seriesId: seriesId || null,
      narratorId: narratorId || null,
      coverImageUrl,
      formatId: formatId || null,
      statusId: statusId || null,
      summary,
      startReadingDate,
      completedDate,
      rating,
      bookNum,
    });

    res.redirect("/books");
  } catch (error) {
    console.error("Error creating book:", error);
    res.status(500).send("Error occurred while creating a book");
  }
});

router.put("/update-status/:id", async (req, res) => {
  try {
    const bookId = req.params.id;
    const { statusId } = req.body;

    const book = await Book.findByPk(bookId);
    if (book) {
      await book.update({ statusId });
      res.status(200).send("Status updated successfully");
    } else {
      res.status(404).send("Book not found");
    }
  } catch (error) {
    console.error("Error updating book status:", error);
    res.status(500).send("Error occurred while updating book status");
  }
});

// In your books.js routes file
router.get("/status-mappings", async (req, res) => {
  try {
    const statuses = await Status.findAll();
    const statusMap = statuses.reduce((map, status) => {
      map[status.name] = status.id;
      return map;
    }, {});

    res.json(statusMap);
  } catch (error) {
    console.error("Error fetching status mappings:", error);
    res.status(500).send("Error occurred while fetching status mappings");
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
    const authors = await Author.findAll({
      order: [["name", "ASC"]],
    });
    const series = await Series.findAll({
      order: [["title", "ASC"]],
    });
    const narrators = await Narrator.findAll({
      order: [["name", "ASC"]],
    });
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
router.put("/:id", upload.single("coverImageFile"), async (req, res) => {
  try {
    const {
      title,
      authorId,
      seriesId,
      narratorId,
      coverImageUrl,
      formatId,
      statusId,
      summary,
      startReadingDate,
      completedDate,
      rating,
      bookNum,
      releaseDate,
    } = req.body;

    let coverImageUrl2 = req.body.coverImageUrl;

    // If a file is uploaded, use the file's path instead of the cover image URL
    if (req.file) {
      coverImageUrl2 = `/uploads/${req.file.filename}`; // Adjust the path based on your static files configuration
    }

    const book = await Book.findByPk(req.params.id);

    await book.update({
      title,
      authorId: authorId || null,
      seriesId: seriesId || null,
      narratorId: narratorId || null,
      coverImageUrl: coverImageUrl2,
      formatId: formatId || null,
      statusId: statusId || null,
      summary,
      startReadingDate,
      completedDate,
      releaseDate,
      rating,
      bookNum,
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
