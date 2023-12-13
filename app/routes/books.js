const express = require("express");
const router = express.Router();
// Controllers
const bookController = require("../controllers/bookController");

// Add Upload support
const upload = require("../../config/uploadConfig");

// Models
const Book = require("../models/Book");
const Author = require("../models/Author");
const Series = require("../models/Series");
const Narrator = require("../models/Narrator");
const Format = require("../models/Format");
const Status = require("../models/Status");

// Main books function call
router.get("/", bookController.searchBooks);
// Grid Call for troubleshooting DB issues
router.get("/grid", bookController.getBooksGrid);
// Filter view (Not implemented)
router.get("/filter", bookController.filterBooksByStatus);
// Update Rating
router.put("/:bookId/update-rating", bookController.updateBookRating);
// Update the status and potentially the completedDate of a book
router.put("/:bookId/update-status", bookController.updateBookStatus);

router.put("/:bookId/update-notes", bookController.updateBookNotes);

// Add this new route for fetching detailed book data
// Should be moved to API
router.get("/details/:bookId", bookController.getBookDetails);

// GET the form for adding a new book
router.get("/add", bookController.addBook);

// POST a new book, with upload.single() middleware to handle the file upload
router.post("/", upload.single("coverImageFile"), bookController.postAddBook);

router.put("/update-status/:id", bookController.putBookUpdateStatus);

// In your books.js routes file
router.get("/status-mappings", bookController.getStatusMappings);

// GET the form for editing a book
router.get("/edit/:id", bookController.getEditId);

// PUT (update) a book
router.put("/:id", upload.single("coverImageFile"), bookController.putEditId);

// DELETE a book
router.delete("/:id", bookController.deleteBook);

module.exports = router;
