const Book = require("../models/Book");
const Author = require("../models/Author");
const Series = require("../models/Series");
const Narrator = require("../models/Narrator");
const Format = require("../models/Format");
const Status = require("../models/Status");
const { Op } = require("sequelize");
const { getStats } = require("./statsController"); // If in the same directory

// Main Books function call that includes search
exports.searchBooks = async (req, res) => {
  try {
    const searchQuery = req.query.search || "";
    const whereConditions = {};
    const searchPerformed = !!searchQuery; // Check if a search query exists

    // Fetch the current and next up books asynchronously
    const currentBookPromise = exports.getCurrentBook(); // Note the usage of exports. to refer to the function
    const nextUpBooksPromise = exports.getNextUpBooks();
    const allBooksPromise = exports.getAllBooks();
    const statsPromise = getStats(); // Fetch stats

    // Wait for both promises to resolve
    const [currentBook, nextUpBooks, allBooks, stats] = await Promise.all([
      currentBookPromise,
      nextUpBooksPromise,
      allBooksPromise,
      statsPromise,
    ]);

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
          required: false,
        },
        {
          model: Series,
          required: false,
        },
        Narrator,
        Format,
        Status,
      ],
    });

    res.render("books/books", {
      books,
      searchQuery,
      currentBook,
      nextUpBooks,
      allBooks,
      searchPerformed,
      stats,
    });
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

exports.getCurrentBook = async () => {
  try {
    const currentBook = await Book.findOne({
      include: [
        {
          model: Status,
          where: { name: "Current" },
        },
        Author,
        Series,
      ],
    });
    // Log the current book or handle it as needed
    //console.log("Current Book:", currentBook);
    return currentBook;
  } catch (error) {
    console.error("Error fetching current book:", error);
    return null;
  }
};

exports.getAllBooks = async () => {
  try {
    const books = await Book.findAll({
      include: [
        { model: Author },
        { model: Series },
        { model: Narrator },
        { model: Format },
        { model: Status },
      ],
    });
    return books;
  } catch (error) {
    console.error("Error fetching all books:", error);
    throw error; // Rethrow the error to handle it in the calling function
  }
};

// Fetch the next up books - make it a function that can be called
exports.getNextUpBooks = async () => {
  try {
    const nextUpBooks = await Book.findAll({
      include: [
        {
          model: Status,
          where: { name: "Next" },
        },
        Author,
        Series,
      ],
      limit: 5, // Limit the number of next up books, adjust as needed
    });
    return nextUpBooks;
  } catch (error) {
    console.error("Error fetching next up books:", error);
    return [];
  }
};

exports.getBooksGrid = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10; // Adjust the number of items per page as needed
    const offset = (page - 1) * limit;

    const { count, rows } = await Book.findAndCountAll({
      limit,
      offset,
      include: [Author, Series, Narrator, Format, Status],
    });

    const totalPages = Math.ceil(count / limit);

    res.render("books/booksGrid", {
      books: rows,
      currentPage: page,
      totalPages,
    });
  } catch (error) {
    console.error("Error fetching books for grid:", error);
    res.status(500).send("Error occurred while fetching books");
  }
};
