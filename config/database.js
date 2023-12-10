const Sequelize = require("sequelize");

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "thedatabase.sqlite", // Update this path as needed
  logging: false,
});

// Sync all models with the database, and make changes if models are updated
// sequelize
//   .sync({ alter: true })
//   .then(() => {
//     console.log("All models were synchronized successfully.");
//   })
//   .catch((err) => {
//     console.error("Error during models synchronization:", err);
//   });

module.exports = sequelize;
