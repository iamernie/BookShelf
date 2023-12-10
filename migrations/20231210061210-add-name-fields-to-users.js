"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("users", "firstName", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("users", "lastName", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.sequelize.query('DROP TABLE IF EXISTS "authors_backup";');

  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("users", "firstName");
    await queryInterface.removeColumn("users", "lastName");
  },
};
