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

    // Get the most read author
    // Get the most read author and the count of their read books
    const mostReadAuthorStats = await getMostReadAuthor();

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
      mostReadAuthor: mostReadAuthorStats ? mostReadAuthorStats.name : "N/A",
      mostReadAuthorCount: mostReadAuthorStats
        ? mostReadAuthorStats.readBooksCount
        : 0,
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

const getMostReadAuthor = async () => {
  try {
    const mostReadAuthor = await Book.findAll({
      attributes: [
        [Sequelize.literal(`"Author"."name"`), "name"],
        [Sequelize.fn("COUNT", Sequelize.col("Book.id")), "readBooksCount"],
      ],
      include: [
        {
          model: Author,
          attributes: [],
        },
      ],
      where: { statusId: 2 }, // Filter for books with 'read' status
      group: ["Author.id", "Author.name"], // Group by author with their name
      order: [[Sequelize.literal("readBooksCount"), "DESC"]], // Order by count of read books
      limit: 1, // Limit to the most read author
      raw: true,
    });

    return mostReadAuthor[0]; // Return the first (and only) author in the list
  } catch (error) {
    console.error("Error finding the most read author:", error);
    throw error;
  }
};
const getStatsSeries = async (seriesId) => {
  try {
    // Convert seriesId to an integer
    const seriesIdInt = parseInt(seriesId, 10);

    // Check if conversion was successful; if not, handle the error
    if (isNaN(seriesIdInt)) {
      throw new Error("Invalid seriesId");
    }
    // Count total number of books in the series
    const totalBooksInSeries = await Book.count({
      where: { seriesId: seriesId },
    });

    // Count the number of books read in the series
    const readBooksInSeries = await Book.count({
      where: {
        seriesId: seriesId,
        statusId: 2, // Assuming statusId 2 indicates 'read'
      },
    });

    // Find the last book read in the series with valid completed date
    const lastReadBookInSeries = await Book.findOne({
      where: {
        seriesId: seriesIdInt,
        statusId: 2,
        completedDate: {
          [Sequelize.Op.ne]: null, // Excludes null
          [Sequelize.Op.not]: "", // Excludes empty string
        },
      },
      order: [["completedDate", "DESC"]],
      attributes: ["title", "completedDate"],
    });

    // console.log("Last Read Book Query Parameters:", {
    //   seriesIdInt,
    //   statusId: 2,
    // });
    // console.log("Last Read Book in Series:", lastReadBookInSeries);

    // Calculate the average rating of the series
    const averageRating = await Book.findAll({
      where: { seriesId: seriesId },
      attributes: [
        [Sequelize.fn("AVG", Sequelize.col("rating")), "averageRating"],
      ],
      raw: true,
    });

    const averageRatingValue = averageRating[0].averageRating
      ? parseFloat(averageRating[0].averageRating).toFixed(2)
      : "Not rated";

    return {
      totalBooksInSeries,
      readBooksInSeries,
      lastReadBookInSeries: lastReadBookInSeries
        ? lastReadBookInSeries.title
        : "None",
      averageRating: averageRatingValue,
    };
  } catch (error) {
    console.error("Error getting series stats:", error);
    throw error;
  }
};

const getStatsAuthor = async (authorId) => {
  try {
    // Convert seriesId to an integer
    const authorIdInt = parseInt(authorId, 10);

    // Check if conversion was successful; if not, handle the error
    if (isNaN(authorIdInt)) {
      throw new Error("Invalid authorId");
    }
    // Count total number of books in the series
    const totalBooksByAuthor = await Book.count({
      where: { authorId: authorId },
    });

    // Count the number of books read by Author
    const readBooksByAuthor = await Book.count({
      where: {
        authorId: authorId,
        statusId: 2, // Assuming statusId 2 indicates 'read'
      },
    });

    // Find the last book read in the series with valid completed date
    const lastReadBookByAuthor = await Book.findOne({
      where: {
        authorId: authorIdInt,
        statusId: 2,
        completedDate: {
          [Sequelize.Op.ne]: null, // Excludes null
          [Sequelize.Op.not]: "", // Excludes empty string
        },
      },
      order: [["completedDate", "DESC"]],
      attributes: ["title", "completedDate"],
    });

    // console.log("Last Read Book Query Parameters:", {
    //   seriesIdInt,
    //   statusId: 2,
    // });
    // console.log("Last Read Book in Series:", lastReadBookInSeries);

    // Author's Books Released in a Given Year (Example: 2023)
    const currentYear = new Date().getFullYear(); // Dynamically get the current year
    const startDate = new Date(currentYear, 0, 1);
    const endDate = new Date(currentYear + 1, 0, 1);
    const booksInYearByAuthor = await Book.count({
      where: {
        authorId: authorId,
        releaseDate: {
          [Sequelize.Op.between]: [startDate, endDate],
        },
      },
    });

    const lastSeriesRead = await Book.findOne({
      where: {
        authorId: authorId,
        seriesId: {
          [Sequelize.Op.ne]: null,
        },
        completedDate: {
          [Sequelize.Op.ne]: null,
        },
      },
      order: [["completedDate", "DESC"]],
      include: [
        {
          model: Series,
          attributes: ["title"],
        },
      ],
    });

    // Format the series title for rendering
    const lastSeriesTitle =
      lastSeriesRead && lastSeriesRead.series
        ? lastSeriesRead.series.title
        : "None";

    // Calculate the average rating of the series
    const averageRating = await Book.findAll({
      where: {
        authorId: authorId,
        statusId: 2, // Adding the condition to check for 'read' status
      },
      attributes: [
        [Sequelize.fn("AVG", Sequelize.col("rating")), "averageRating"],
      ],
      raw: true,
    });

    const averageRatingValue = averageRating[0].averageRating
      ? parseFloat(averageRating[0].averageRating).toFixed(2)
      : "Not rated";

    return {
      totalBooksByAuthor,
      readBooksByAuthor,
      lastReadBookByAuthor: lastReadBookByAuthor
        ? lastReadBookByAuthor.title
        : "None",
      averageRating: averageRatingValue,
      booksInYearByAuthor,
      lastSeriesTitle,
    };
  } catch (error) {
    console.error("Error getting Author stats:", error);
    throw error;
  }
};

const getAuthorStatistics = async (authorId) => {
  try {
    // Total Number of Books by the Author
    const totalBooksByAuthor = await Book.count({
      where: { authorId: authorId },
    });

    // Author's Books Released in a Given Year (Example: 2023)
    const year = 2023;
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);
    const booksInYearByAuthor = await Book.count({
      where: {
        authorId: authorId,
        releaseDate: {
          [Sequelize.Op.between]: [startDate, endDate],
        },
      },
    });

    // Average Rating for the Author's Books
    const averageRatingResult = await Book.findOne({
      attributes: [
        [Sequelize.fn("AVG", Sequelize.col("rating")), "averageRating"],
      ],
      where: { authorId: authorId },
      raw: true,
    });
    const averageRating = averageRatingResult
      ? parseFloat(averageRatingResult.averageRating).toFixed(2)
      : "Not rated";

    // Last Book Read by the Author
    const lastBookRead = await Book.findOne({
      where: {
        authorId: authorId,
        completedDate: {
          [Sequelize.Op.ne]: null,
        },
      },
      order: [["completedDate", "DESC"]],
      attributes: ["title", "completedDate"],
      raw: true,
    });

    // Last Series Read by the Author
    // Assuming a book belongs to a series and an author
    const lastSeriesRead = await Book.findOne({
      where: {
        authorId: authorId,
        seriesId: {
          [Sequelize.Op.ne]: null,
        },
        completedDate: {
          [Sequelize.Op.ne]: null,
        },
      },
      order: [["completedDate", "DESC"]],
      include: [
        {
          model: Series,
          attributes: ["title"],
        },
      ],
      raw: true,
    });

    // Format the series title for rendering
    const lastSeriesTitle = lastSeriesRead
      ? lastSeriesRead["Series.title"]
      : "None";

    return {
      totalBooks: totalBooksByAuthor,
      booksInYear: booksInYearByAuthor,
      averageRating: averageRating,
      lastBookRead: lastBookRead
        ? {
            title: lastBookRead.title,
            completedDate: lastBookRead.completedDate,
          }
        : null,
      lastSeriesRead: lastSeriesTitle,
    };
  } catch (error) {
    console.error("Error getting author statistics:", error);
    throw error;
  }
};

module.exports = {
  getStats,
  showStats,
  getLatestReadBook,
  getStatsSeries,
  getStatsAuthor,
};
