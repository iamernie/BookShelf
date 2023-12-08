const Author = require("./app/models/Author");
const Series = require("./app/models/Series");
const Book = require("./app/models/Book");
const Narrator = require("./app/models/Narrator");
const Format = require("./app/models/Format");
const BookFormat = require("./app/models/BookFormat");

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
}

module.exports = setAssociations;
