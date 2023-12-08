const express = require("express");
const router = express.Router();
const Narrator = require("../models/Narrator"); // Adjust the path as necessary

// GET all narrators
router.get("/", async (req, res) => {
  try {
    const narrators = await Narrator.findAll();
    res.render("narrators/listNarrators", { narrators });
  } catch (error) {
    res.status(500).send("Error occurred: " + error.message);
  }
});

// GET the form for adding a new narrator
router.get("/add", (req, res) => {
  res.render("narrators/addNarrator");
});

// POST a new narrator
router.post("/", async (req, res) => {
  try {
    const { name, bio } = req.body;
    await Narrator.create({ name, bio });
    res.redirect("/narrators");
  } catch (error) {
    res.status(500).send("Error occurred: " + error.message);
  }
});

// GET the form for editing a narrator
router.get("/edit/:id", async (req, res) => {
  try {
    const narrator = await Narrator.findByPk(req.params.id);
    if (narrator) {
      res.render("narrators/editNarrator", { narrator });
    } else {
      res.status(404).send("Narrator not found");
    }
  } catch (error) {
    res.status(500).send("Error occurred: " + error.message);
  }
});

// PUT (update) a narrator
router.put("/:id", async (req, res) => {
  try {
    const { name, bio } = req.body;
    await Narrator.update(
      { name, bio },
      {
        where: { id: req.params.id },
      }
    );
    res.redirect("/narrators");
  } catch (error) {
    res.status(500).send("Error occurred: " + error.message);
  }
});

// DELETE a narrator
router.delete("/:id", async (req, res) => {
  try {
    await Narrator.destroy({
      where: { id: req.params.id },
    });
    res.redirect("/narrators");
  } catch (error) {
    res.status(500).send("Error occurred: " + error.message);
  }
});

module.exports = router;
