const Sequelize = require("sequelize");
const sequelize = require("../../config/database");

const Book = sequelize.define("book", {
  title: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  authorId: {
    type: Sequelize.INTEGER,
    allowNull: true,
    references: {
      model: "authors", // 'authors' refers to table name
      key: "id", // 'id' refers to column name in authors table
    },
  },
  seriesId: {
    type: Sequelize.INTEGER,
    allowNull: true,
    references: {
      model: "series", // 'series' refers to table name
      key: "id", // 'id' refers to column name in series table
    },
  },
  narratorId: {
    type: Sequelize.INTEGER,
    allowNull: true,
    references: {
      model: "narrators", // 'series' refers to table name
      key: "id", // 'id' refers to column name in series table
    },
    allowNull: true,
  },
  statusId: {
    type: Sequelize.INTEGER,
    allowNull: true,
    references: {
      model: "statuses", // 'series' refers to table name
      key: "id", // 'id' refers to column name in series table
    },
    allowNull: true,
  },

  startReadingDate: Sequelize.DATE,
  completedDate: Sequelize.DATE,
  releaseDate: {
    type: Sequelize.DATE,
    allowNull: true, // Allow null if you want to make the field optional
    defaultValue: Sequelize.NOW // Sets the default value to the current date
  },
  rating: Sequelize.INTEGER,

  coverImageUrl: Sequelize.STRING,
  bookNum: Sequelize.INTEGER,
  formatId: {
    type: Sequelize.INTEGER,
    allowNull: true,
    references: {
      model: "formats", // Assuming 'formats' is your table name
      key: "id",
    },
  },
  summary: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  comments: {
    type: Sequelize.TEXT,
    allowNull: true,
  }
});

module.exports = Book;
