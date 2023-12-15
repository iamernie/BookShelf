const Sequelize = require("sequelize");
const sequelize = require("../../config/database");

const Series = sequelize.define("series", {
  title: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  description: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  numBooks: Sequelize.INTEGER,
  comments: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  statusId: {
    type: Sequelize.INTEGER,
    allowNull: true,
    references: {
      model: "seriesstatuses", // 'series' refers to table name
      key: "id", // 'id' refers to column name in series table
    },
    allowNull: true,
  },
  genreId: {
    type: Sequelize.INTEGER,
    allowNull: true, // allowNull based on your business logic
    references: {
      model: "genres", // 'genres' refers to table name
      key: "id", // 'id' refers to column name in genres table
    },
  },
  comments: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
});

module.exports = Series;
