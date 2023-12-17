require("dotenv").config();
const path = require("path");

const express = require("express");
const bodyParser = require("body-parser");
const sequelize = require("./config/database");
const setAssociations = require("./associations");
const methodOverride = require("method-override");
const flash = require("connect-flash");
const session = require("express-session"); // Session middleware
const passport = require("passport");

// Import your passport configuration
const initializePassport = require("./config/passport-config");
initializePassport(passport);

const app = express();

const packageJson = require("./package.json"); // Adjust the path as necessary

// Set the version as a local variable accessible in all views
app.locals.version = packageJson.version;

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET, // Use an environment variable for the secret
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to false since you are not using HTTPS
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // Optional: set cookie expiration duration
    },
  })
);
// Set the default views directory
app.set("views", path.join(__dirname, "views"));

// Initialize Passport and its session
app.use(passport.initialize());
app.use(passport.session());

// Initialize connect-flash
app.use(flash());

// Setting up the view engine, if you're using one (like ejs)
app.set("view engine", "ejs");

// Serve static files from the "public" directory
app.use(express.static("public"));

// Middlewares
app.use(methodOverride("_method"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
// Middleware to pass the user information to all requests.
app.use((req, res, next) => {
  res.locals.user = req.user || null; // If req.user is undefined, set it to null
  next();
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  // Redirect to login page if not authenticated
  res.redirect("/login");
}

// Importing routes
const appRouter = require("./app/routes/main");
const booksRouter = require("./app/routes/books");
const authorsRouter = require("./app/routes/authors");
const seriesRouter = require("./app/routes/series");
const narratorsRouter = require("./app/routes/narrators");
const formatsRouter = require("./app/routes/format");
const statusRouter = require("./app/routes/status");
const authRoutes = require("./app/routes/auth");
const adminRouter = require("./app/routes/admin");
const statsRouter = require("./app/routes/stats");
const genresRouter = require("./app/routes/genre");
const apiRouter = require("./app/routes/api");

// Routes
app.use(authRoutes);
app.use("/", appRouter);
app.use("/uploads", express.static("uploads"));
app.use("/stats", statsRouter);

// Protected Routes
app.use("/admin", ensureAuthenticated, adminRouter);
app.use("/books", booksRouter);
app.use("/authors", authorsRouter);
app.use("/series", seriesRouter);
app.use("/narrators", narratorsRouter);
app.use("/formats", formatsRouter);
app.use("/genres", genresRouter);
app.use("/status", statusRouter);
app.use("/api", apiRouter);

// Database Associations
setAssociations();

// Syncing database models
sequelize
  .sync()
  .then(() => console.log("Database & tables created!"))
  .catch((err) => console.error("Error initializing database", err));

// Starting the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
console.log("Version: " + packageJson.version);

module.exports = app;
