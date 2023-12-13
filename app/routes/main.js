const express = require("express");
const router = express.Router();
const multer = require("multer");
const slugify = require("slugify");

const Book = require("../models/Book");
const Author = require("../models/Author");
const Series = require("../models/Series");
const Narrator = require("../models/Narrator");
const Format = require("../models/Format");
const Status = require("../models/Status");

router.get("/", (req, res) => {
  res.redirect("/books"); // Redirect to the books route
});

// // Route for the landing page
// router.get("/", async (req, res) => {
//   try {
//     // Fetch the current book
//     const currentBook = await Book.findOne({
//       include: [
//         {
//           model: Status,
//           where: { name: "Current" },
//         },
//         Author,
//         Series,
//       ],
//     });
//     //console.log("Current Book:", currentBook); // Log the current book

//     // Fetch the next up books
//     const nextUpBooks = await Book.findAll({
//       include: [
//         {
//           model: Status,
//           where: { name: "Next" },
//         },
//         Author,
//         Series,
//       ],
//       limit: 5, // Limit the number of next up books, adjust as needed
//     });
//     //console.log("Next Up Books:", nextUpBooks); // Log the next up books
//     //console.log("User:" + req.user); // Check if the user object is available
//     res.render("index", { currentBook, nextUpBooks, user: req.user });
//   } catch (error) {
//     console.error("Error fetching books:", error);
//     res.status(500).send("Error occurred while fetching books");
//   }
// });

module.exports = router;
