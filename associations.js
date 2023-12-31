const Author = require("./app/models/Author");
const Series = require("./app/models/Series");
const Book = require("./app/models/Book");
const Narrator = require("./app/models/Narrator");
const Format = require("./app/models/Format");
const Status = require("./app/models/Status");
const SeriesStatus = require("./app/models/SeriesStatus");
const Genre = require("./app/models/Genre"); // Include the Genre model

// Define associations
function setAssociations() {
  Book.belongsTo(Author, { foreignKey: "authorId", allowNull: true });
  Author.hasMany(Book, { foreignKey: "authorId", allowNull: true });

  Book.belongsTo(Series, { foreignKey: "seriesId", allowNull: true });
  Series.hasMany(Book, { foreignKey: "seriesId", allowNull: true });

  Book.belongsTo(Narrator, { foreignKey: "narratorId", allowNull: true });
  Narrator.hasMany(Book, { foreignKey: "narratorId", allowNull: true });

  Format.hasMany(Book, { foreignKey: "formatId", allowNull: true });
  Book.belongsTo(Format, { foreignKey: "formatId", allowNull: true });

  Status.hasMany(Book, { foreignKey: "statusId", allowNull: true });
  Book.belongsTo(Status, { foreignKey: "statusId", allowNull: true });

  SeriesStatus.hasMany(Series, { foreignKey: "statusId", allowNull: true });
  Series.belongsTo(SeriesStatus, { foreignKey: "statusId", allowNull: true });

  // New associations with Genre
  Genre.hasMany(Book, { foreignKey: "genreId", allowNull: true });
  Book.belongsTo(Genre, { foreignKey: "genreId", allowNull: true });

  Genre.hasMany(Series, { foreignKey: "genreId", allowNull: true });
  Series.belongsTo(Genre, { foreignKey: "genreId", allowNull: true });
}

module.exports = setAssociations;
