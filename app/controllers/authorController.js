const Author = require("../models/Author"); // Adjust the path as necessary
const Status = require("../models/Status"); //
const Narrator = require("../models/Narrator");
const Series = require("../models/Series"); // Adjust the path as necessary
const Book = require("../models/Book"); // Make sure this path is correct
const { getStatsAuthor } = require("../controllers/statsController"); // Adjust the path

exports.getAuthors = async (req, res) => {
  try {
    const authors = await Author.findAll();
    res.render("authors/listAuthors", { authors });
  } catch (error) {
    console.error("Error fetching authors:", error);
    res.status(500).send("Error occurred while fetching authors");
  }
};

exports.getAddAuthor = async (req, res) => {
  res.render("authors/addAuthor");
};

exports.getBooksByAuthor = async (req, res) => {
  try {
    const authorId = req.params.id;
    const stats = await getStatsAuthor(authorId);
    const books = await Book.findAll({
      where: { authorId: authorId },
      include: [Series, Author, Status, Narrator], // Include other related models as needed
      order: [["title", "ASC"]],
    });
    const author = await Author.findByPk(authorId);
    books.forEach((book) => {
      book.fromAuthor = true; // Add this line
    });

    res.render("authors/authorBooks", {
      books,
      authorId,
      author,
      stats: stats,
    }); // Render a view with the books in the series
  } catch (error) {
    console.error("Error fetching books by author:", error);
    res.status(500).send("Error occurred while fetching books");
  }
};

exports.getEditAuthor = async (req, res) => {
  try {
    const author = await Author.findByPk(req.params.id);
    if (author) {
      res.render("authors/editAuthor", { author });
    } else {
      res.status(404).send("Author not found");
    }
  } catch (error) {
    console.error("Error fetching author:", error);
    res.status(500).send("Error occurred while fetching the author");
  }
};

exports.postAddAuthor = async (req, res) => {
  try {
    const { name } = req.body; // Adjust according to your fields
    await Author.create({ name });
    res.redirect("/authors");
  } catch (error) {
    console.error("Error creating author:", error);
    res.status(500).send("Error occurred while creating an author");
  }
};

exports.putEditAuthor = async (req, res) => {
  try {
    const { name } = req.body; // Adjust according to your fields
    const updated = await Author.update(
      { name },
      {
        where: { id: req.params.id },
      }
    );

    if (updated) {
      res.redirect("/authors");
    } else {
      res.status(404).send("Author not found");
    }
  } catch (error) {
    console.error("Error updating author:", error);
    res.status(500).send("Error occurred while updating the author");
  }
};

exports.putEditAuthorDesc = async (req, res) => {
  try {
    const authorId = req.params.authorId;
    const { comments } = req.body;

    const author = await Author.findByPk(authorId);
    if (!author) {
      return res.status(404).send("Author not found");
    }

    await author.update({ comments });
    res.send("Author comments updated successfully");
  } catch (error) {
    console.error("Error updating Author comments:", error);
    res.status(500).send("Error updating Author comments");
  }
};

exports.delAuthor = async (req, res) => {
  try {
    const deleted = await Author.destroy({
      where: { id: req.params.id },
    });

    if (deleted) {
      res.redirect("/authors");
    } else {
      res.status(404).send("Author not found");
    }
  } catch (error) {
    console.error("Error deleting author:", error);
    res.status(500).send("Error occurred while deleting the author");
  }
};
