"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("Series", "genreId", {
      type: Sequelize.INTEGER,
      references: {
        model: "Genres", // Name of the Genre table
        key: "id", // Key in Genre to reference
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("Series", "genreId");
  },
};
