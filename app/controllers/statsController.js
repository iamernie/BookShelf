const Sequelize = require("sequelize");
const Book = require("../models/Book");
const Author = require("../models/Author");
const Series = require("../models/Series");
const Narrator = require("../models/Narrator");

const getStats = async (req, res) => {
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

module.exports = {
  getStats,
};
