const express = require("express");
const router = express.Router();

const GenreController = require("../controllers/genreController");

// GET all genres
router.get("/", GenreController.getAllGenres);

// GET the form for adding a new genre
router.get("/add", GenreController.getAddGenre);

// POST a new genre
router.post("/", GenreController.postNewGenre);

// GET the form for editing a genre
router.get("/:id", GenreController.getGenre);

// POST an update to a genre
router.put("/:id", GenreController.putEditGenre);

module.exports = router;
