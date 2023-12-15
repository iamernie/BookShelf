"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Genres", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: new Date(),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: new Date(),
      },
    });

    // Optional: Pre-populate the Genre table with common genres
    const genres = [
      "Fantasy",
      "Science Fiction",
      "Mystery",
      "Thriller",
      "Romance",
      "Historical",
    ];
    const genreData = genres.map((genre) => ({
      name: genre,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    await queryInterface.bulkInsert("Genres", genreData, {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("Genres");
  },
};
