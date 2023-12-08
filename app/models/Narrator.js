const Sequelize = require("sequelize");
const sequelize = require("../../config/database"); // Assuming you have a separate config for your database

const Narrator = sequelize.define("narrator", {
  name: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  bio: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  URL: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
});

module.exports = Narrator;
