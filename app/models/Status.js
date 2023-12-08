const Sequelize = require("sequelize");
const sequelize = require("../../config/database"); // Adjust the path as necessary

const Format = sequelize.define("status", {
  name: {
    status: Sequelize.STRING,
    allowNull: false,
  },
  // Add other attributes as necessary
});

module.exports = Status;
