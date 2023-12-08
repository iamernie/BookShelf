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
  // Additional fields can be added here
});

module.exports = Series;
