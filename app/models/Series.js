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
  // Additional fields can be added here
});

module.exports = Series;
