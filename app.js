const express = require("express");
const bodyParser = require("body-parser");
const sequelize = require("./config/database");
const setAssociations = require("./associations");
const methodOverride = require("method-override");

// Importing routes
const appRouter = require("./app/routes/main");
const booksRouter = require("./app/routes/books");
const authorsRouter = require("./app/routes/authors");
const seriesRouter = require("./app/routes/series");
const narratorsRouter = require("./app/routes/narrators");
const formatsRouter = require("./app/routes/format");
const statusRouter = require("./app/routes/status");

const app = express();
app.use(express.json());

// Middlewares
app.use(methodOverride("_method"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Setting up the view engine, if you're using one (like ejs)
app.set("view engine", "ejs");

// Serve static files from the "public" directory
app.use(express.static("public"));

// Database Associations
setAssociations();

// Syncing database models
sequelize
  .sync()
  .then(() => console.log("Database & tables created!"))
  .catch((err) => console.error("Error initializing database", err));

// Routes
app.use("/", appRouter);
app.use("/books", booksRouter);
app.use("/authors", authorsRouter);
app.use("/series", seriesRouter);
app.use("/narrators", narratorsRouter);
app.use("/formats", formatsRouter);
app.use("/status", statusRouter);
app.use("/uploads", express.static("uploads"));

// Starting the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
