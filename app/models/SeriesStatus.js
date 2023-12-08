const Sequelize = require("sequelize");
const sequelize = require("../../config/database"); // Adjust the path as necessary

const SeriesStatus = sequelize.define("seriesstatus", {
  name: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  // Add other attributes as necessary
});

module.exports = SeriesStatus;
