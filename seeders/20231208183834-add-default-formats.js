"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert("Formats", [
      {
        name: "eBook",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Audio",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Physical",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    await queryInterface.bulkInsert("Authors", [
      {
        name: "Craig Alanson",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "B.V. Larson",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Christopher Hopper",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "M.R. Forbes",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "J.N. Chaney",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    await queryInterface.bulkInsert("Statuses", [
      {
        name: "Unread",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Read",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Current",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Next",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Parked",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Shelved",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    await queryInterface.bulkInsert("SeriesStatuses", [
      {
        name: "Unread",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Read",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Current",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Next",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Parked",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Shelved",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Ended",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
  },
};
