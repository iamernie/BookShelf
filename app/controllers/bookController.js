const Book = require("../models/Book");
const Author = require("../models/Author");
const Series = require("../models/Series");
const Narrator = require("../models/Narrator");
const Format = require("../models/Format");
const Status = require("../models/Status");
const { Op } = require("sequelize");

exports.searchBooks = async (req, res) => {
  try {
    const searchQuery = req.query.search || "";
    const whereConditions = {};

    if (searchQuery) {
      // Search in book title, author name, and series title
      whereConditions[Op.or] = [
        { title: { [Op.like]: `%${searchQuery}%` } },
        { "$Author.name$": { [Op.like]: `%${searchQuery}%` } },
        { "$Series.title$": { [Op.like]: `%${searchQuery}%` } },
      ];
    }

    const books = await Book.findAll({
      where: whereConditions,
      include: [
        {
          model: Author,
          required: false, // Required false ensures books without authors are also returned
        },
        {
          model: Series,
          required: false, // Required false ensures books without series are also returned
        },
        Narrator,
        Format,
        Status,
      ],
    });

    res.render("books/Books", { books, searchQuery });
  } catch (error) {
    console.error("Error fetching books:", error);
    res.status(500).send("Error occurred while fetching books");
  }
};

exports.filterBooksByStatus = async (req, res) => {
  try {
    const statusId = req.query.status;
    let books;

    if (statusId) {
      books = await Book.findAll({
        where: { statusId: statusId },
        include: [Author, Series, Narrator, Format, Status],
      });
    } else {
      books = await Book.findAll({
        include: [Author, Series, Narrator, Format, Status],
      });
    }

    res.render("books/books", { books }); // Using the same view as for the main book list
  } catch (error) {
    console.error("Error fetching books by status:", error);
    res.status(500).send("Error occurred while fetching books");
  }
};
