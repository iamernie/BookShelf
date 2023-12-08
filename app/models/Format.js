const Sequelize = require("sequelize");
const sequelize = require("../../config/database"); // Adjust the path as necessary

const Format = sequelize.define("format", {
  name: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  // Add other attributes as necessary
});

module.exports = Format;
