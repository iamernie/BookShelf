const Sequelize = require("sequelize");
const sequelize = require("../../config/database"); // Adjust the path according to your project structure

const Genre = sequelize.define(
  "Genre",
  {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    name: {
      type: Sequelize.STRING,
      allowNull: false,
    },
  },
  {
    timestamps: true, // Assuming you are tracking createdAt and updatedAt
  }
);

module.exports = Genre;
