const express = require("express");
const router = express.Router();

const AuthorController = require("../controllers/authorController");

// GET all authors
router.get("/", AuthorController.getAuthors);

// GET the form for adding a new author
router.get("/add", AuthorController.getAddAuthor);

// GET all books by an author
router.get("/:id/books", AuthorController.getBooksByAuthor);

// GET the form for editing an author
router.get("/edit/:id", AuthorController.getEditAuthor);

// POST a new author
router.post("/", AuthorController.postAddAuthor);

// PUT (update) an author
router.put("/:id", AuthorController.putEditAuthor);

// Update Author description
router.put("/:authorId/update-description", AuthorController.putEditAuthorDesc);

// DELETE an author
router.delete("/:id", AuthorController.delAuthor);

module.exports = router;
