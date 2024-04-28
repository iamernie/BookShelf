const Book = require("../models/Book");
const Author = require("../models/Author");
const Series = require("../models/Series");
const Narrator = require("../models/Narrator");
const Format = require("../models/Format");
const Genre = require("../models/Genre");
const Status = require("../models/Status");
const { Op } = require("sequelize");
const { getStats } = require("./statsController"); // If in the same directory

// Main Books function call that includes search
exports.searchBooks = async (req, res) => {
  try {
    const searchQuery = req.query.search || "";
    const statusFilter = req.query.status || null;
    const whereConditions = {};
    const searchPerformed = !!searchQuery; // Check if a search query exists

    // Fetch the current and next up books asynchronously
    const currentBooksPromise = exports.getCurrentBooks();
    const nextUpBooksPromise = exports.getNextUpBooks();
    const allBooksPromise = exports.getAllBooks();
    const statsPromise = getStats(); // Fetch stats
    const statuses = await Status.findAll();

    // Wait for all promises to resolve
    const [currentBooks, nextUpBooks, allBooks, stats] = await Promise.all([
      currentBooksPromise,
      nextUpBooksPromise,
      allBooksPromise,
      statsPromise,
    ]);

    // Apply search query if it exists
    if (searchQuery) {
      whereConditions[Op.or] = [
        { title: { [Op.like]: `%${searchQuery}%` } },
        { "$Author.name$": { [Op.like]: `%${searchQuery}%` } },
        { "$Series.title$": { [Op.like]: `%${searchQuery}%` } },
      ];
    }

    console.log("Status Filter: ", statusFilter); // Debugging"
    if (statusFilter == 1) {
      // Find the "Read" status ID
      const readStatus = await Status.findOne({ where: { name: "Read" } });
      if (readStatus) {
        // Exclude books with the "Read" status
        whereConditions.statusId = { [Op.not]: readStatus.id };
      }
    } else if (statusFilter) {
      // Apply the selected status filter
      whereConditions.statusId = statusFilter;
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
      order: [
        ["title", "ASC"], // Assuming you want to order by title
      ],
    });

    // Render the page with the filtered and/or searched books
    res.render("books/books", {
      books,
      searchQuery,
      currentBooks,
      nextUpBooks,
      allBooks,
      searchPerformed,
      stats,
      statuses,
      searchQuery: req.query.search || "",
      statusFilter: req.query.status || "",
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

exports.getCurrentBooks = async () => {
  try {
    return await Book.findAll({
      include: [{ model: Status, where: { name: "Current" } }, Author, Series],
    });
  } catch (error) {
    console.error("Error fetching current books:", error);
    return [];
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
        { model: Genre },
      ],
    });
    return books;
  } catch (error) {
    console.error("Error fetching all books:", error);
    throw error; // Rethrow the error to handle it in the calling function
  }
};

exports.JSONgetBooks = async (req, res) => {
  try {
    let books;
    if (req.params.id) {
      books = await Book.findOne({
        where: { id: req.params.id },
        include: [
          { model: Author },
          { model: Series },
          { model: Narrator },
          { model: Format },
          { model: Status },
        ],
      });
    } else {
      books = await Book.findAll({
        include: [
          { model: Author },
          { model: Series },
          { model: Narrator },
          { model: Format },
          { model: Status },
        ],
      });
    }
    res.json(books);
  } catch (error) {
    console.error("Error fetching books:", error);
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

exports.updateBookRating = async (req, res) => {
  try {
    const bookId = req.params.bookId;
    const { rating } = req.body;
    const book = await Book.findByPk(bookId);
    if (!book) return res.status(404).send("Book not found");
    await book.update({ rating });
    res.json({ message: "Rating updated successfully" });
  } catch (error) {
    console.error("Error updating book rating:", error);
    res.status(500).send("Error occurred while updating the book rating");
  }
};

exports.updateBookStatus = async (req, res) => {
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
};

exports.updateBookNotes = async (req, res) => {
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
};

exports.getBookDetails = async (req, res) => {
  try {
    const bookId = req.params.bookId;
    const book = await Book.findByPk(bookId, {
      include: [Author, Series, Narrator, Format, Status, Genre],
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
};

exports.addBook = async (req, res) => {
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
    const genres = await Genre.findAll();
    res.render("books/addBook", {
      authors,
      series,
      narrators,
      formats,
      statuses,
      genres,
    });
  } catch (error) {
    console.error("Error fetching data for adding book:", error);
    res.status(500).send("Error occurred while preparing to add a book");
  }
};

exports.postAddBook = async (req, res) => {
  try {
    const {
      title,
      authorId,
      seriesId,
      narratorId,
      formatIds,
      statusId,
      summary,
      releaseDate,
      startReadingDate,
      completedDate,
      rating,
      bookNum,
      genreId,
    } = req.body;

    let coverImageUrl = req.body.coverImageUrl;

    // If a file is uploaded, use the file's path
    if (req.file) {
      coverImageUrl = `/uploads/${req.file.filename}`;
    } else if (!coverImageUrl) {
      // If no image URL is provided, use the placeholder image
      coverImageUrl = "/static/placeholder.png";
    }
    const newBook = await Book.create({
      title,
      authorId: authorId || null,
      seriesId: seriesId || null,
      narratorId: narratorId || null,
      coverImageUrl,
      formatId: formatIds || null,
      statusId: statusId || null,
      summary,
      releaseDate,
      startReadingDate,
      completedDate,
      rating,
      bookNum,
      genreId: genreId || null,
    });
    console.log("Received formatId:", formatIds);

    res.redirect("/books");
  } catch (error) {
    console.error("Error creating book:", error);
    res.status(500).send("Error occurred while creating a book");
  }
};

exports.putBookUpdateStatus = async (req, res) => {
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
};

exports.getStatusMappings = async (req, res) => {
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
};

exports.getEditId = async (req, res) => {
  try {
    const book = await Book.findByPk(req.params.id, {
      include: [
        { model: Author },
        { model: Series },
        { model: Narrator },
        { model: Format },
        { model: Status },
        { model: Genre },
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
    const genres = await Genre.findAll();
    const statuses = await Status.findAll();
    if (book) {
      res.render("books/editBook", {
        book,
        authors,
        series,
        narrators,
        formats,
        statuses,
        genres,
      });
    } else {
      res.status(404).send("Book not found");
    }
  } catch (error) {
    console.error("Error fetching book for edit:", error);
    res.status(500).send("Server error");
  }
};
exports.putEditId = async (req, res) => {
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
      releaseDate,
      genreId,
    } = req.body;

    let coverImageUrl2 = req.body.coverImageUrl;

    // If a file is uploaded, use the file's path
    if (req.file) {
      coverImageUrl2 = `/uploads/${req.file.filename}`;
    } else if (!coverImageUrl2) {
      // If no image URL is provided, use the placeholder image
      coverImageUrl2 = "/static/placeholder.png";
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
      genreId: genreId || null,
    });

    res.redirect("/books");
  } catch (error) {
    console.error("Error updating book:", error);
    res.status(500).send("Error occurred while updating the book");
  }
};
exports.deleteBook = async (req, res) => {
  try {
    await Book.destroy({ where: { id: req.params.id } });
    res.status(200).json({ message: "Book deleted successfully" });
    req.flash("success_msg", "Book deleted successfully"); // Set a flash message
  } catch (error) {
    console.error("Error deleting book:", error);
    res.status(500).send("Error occurred while deleting the book");
  }
};
