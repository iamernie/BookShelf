const Sequelize = require("sequelize");
const sequelize = require("../../config/database"); // Assuming you have a separate config for your database

const Author = sequelize.define("author", {
  name: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  // Add additional fields as needed
});

module.exports = Author;
