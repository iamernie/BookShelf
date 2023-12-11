"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn(
      "Series", // Make sure 'Series' matches your table name
      "comments", // Name of the new column
      {
        type: Sequelize.TEXT, // Use TEXT for longer strings
        allowNull: true, // Set to false if you want it to be a required field
        defaultValue: null, // Default value if any
      }
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("Series", "comments");
  },
};
