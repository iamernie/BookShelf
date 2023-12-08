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
  startReadingDate: Sequelize.DATE,
  completedDate: Sequelize.DATE,
  rating: Sequelize.INTEGER,
  currentStatus: Sequelize.STRING,
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
});

module.exports = Book;
