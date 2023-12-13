const Sequelize = require("sequelize");
const sequelize = require("../../config/database"); // Adjust this path to your Sequelize database configuration
const Book = require("../models/Book");
const Author = require("../models/Author");
const Series = require("../models/Series");
const Narrator = require("../models/Narrator");

const showStats = async (req, res) => {
  try {
    const totalBooks = await Book.count();
    const readBooks = await Book.count({ where: { statusId: 2 } });
    const totalSeries = await Series.count();

    // Most popular author
    const popularAuthor = await Book.findOne({
      attributes: [
        [Sequelize.literal(`"Author"."name"`), "name"],
        [
          Sequelize.fn("COUNT", Sequelize.col("Book.authorId")),
          "numberOfBooks",
        ],
      ],
      include: [
        {
          model: Author,
          attributes: [],
        },
      ],
      group: ["Book.authorId", "Author.id", "Author.name"],
      order: [[Sequelize.literal("numberOfBooks"), "DESC"]],
      raw: true,
    });

    // Most popular narrator
    const popularNarrator = await Book.findOne({
      attributes: [
        [Sequelize.literal(`"Narrator"."name"`), "name"],
        [
          Sequelize.fn("COUNT", Sequelize.col("Book.narratorId")),
          "numberOfBooks",
        ],
      ],
      include: [
        {
          model: Narrator,
          attributes: [],
        },
      ],
      group: ["Book.narratorId", "Narrator.id", "Narrator.name"],
      order: [[Sequelize.literal("numberOfBooks"), "DESC"]],
      raw: true,
    });

    res.render("stats/stats", {
      totalBooks,
      readBooks,
      totalSeries,
      popularAuthor: popularAuthor ? popularAuthor : null,
      popularNarrator: popularNarrator ? popularNarrator : null,
    });
  } catch (error) {
    console.error("Error getting stats:", error);
    res.status(500).send("Server error occurred fetching stats");
  }
};

const getStats = async () => {
  try {
    // Total number of books
    const totalBooks = await Book.count();

    // Total number of read books
    const readBooks = await Book.count({ where: { statusId: 2 } }); // Assuming statusId 2 indicates 'read'

    // Total number of series
    const totalSeries = await Series.count();

    // Get the latest read book
    const latestReadBook = await getLatestReadBook();

    // Most popular author query
    const popularAuthorQuery = `
      SELECT "Author"."name", COUNT("Book"."authorId") AS "numberOfBooks"
      FROM "Books" AS "Book"
      JOIN "Authors" AS "Author" ON "Book"."authorId" = "Author"."id"
      GROUP BY "Author"."id"
      ORDER BY "numberOfBooks" DESC
      LIMIT 1
    `;

    const popularAuthor = await sequelize
      .query(popularAuthorQuery, {
        type: Sequelize.QueryTypes.SELECT,
        raw: true,
      })
      .then((results) => results[0] || null);

    // Most popular narrator query
    const popularNarratorQuery = `
      SELECT "Narrator"."name", COUNT("Book"."narratorId") AS "numberOfBooks"
      FROM "Books" AS "Book"
      JOIN "Narrators" AS "Narrator" ON "Book"."narratorId" = "Narrator"."id"
      GROUP BY "Narrator"."id"
      ORDER BY "numberOfBooks" DESC
      LIMIT 1
    `;

    const popularNarrator = await sequelize
      .query(popularNarratorQuery, {
        type: Sequelize.QueryTypes.SELECT,
        raw: true,
      })
      .then((results) => results[0] || null);

    // Format the latest read book data for rendering, if it exists
    const latestBookData = latestReadBook
      ? {
          title: latestReadBook.title,
          authorName: latestReadBook.Author
            ? latestReadBook.Author.name
            : "Unknown",
          completedDate: latestReadBook.completedDate,
        }
      : null;
    return {
      totalBooks,
      readBooks,
      totalSeries,
      popularAuthor,
      popularNarrator,
      latestReadBook: latestBookData,
    };
  } catch (error) {
    console.error("Error getting stats:", error);
    return { error: "Server error occurred fetching stats" };
  }
};

const getLatestReadBook = async () => {
  try {
    const latestReadBook = await Book.findOne({
      where: {
        completedDate: {
          [Sequelize.Op.ne]: null, // Checks for non-null completedDate
          [Sequelize.Op.not]: "", // Add this to exclude empty strings if they are considered invalid
          // You can add additional checks here for any other 'invalid' date formats
        },
      },
      order: [["completedDate", "DESC"]], // Orders by the completedDate in descending order
      include: [
        {
          model: Author,
          attributes: ["name"], // Assuming you have an Author model
        },
      ],
    });

    return latestReadBook;
  } catch (error) {
    console.error("Error finding the latest read book:", error);
    throw error;
  }
};

module.exports = {
  getStats,
  showStats,
  getLatestReadBook,
};
