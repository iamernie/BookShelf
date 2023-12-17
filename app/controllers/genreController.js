const Genre = require("../models/Genre");

exports.JSONgetAllGenres = async (req, res) => {
  try {
    const genres = await Genre.findAll({
      order: [["name", "ASC"]],
    });
    res.json(genres); // Send the statuses as JSON
  } catch (error) {
    console.error("Error fetching genres:", error);
    res.status(500).send("Error occurred while fetching genres");
  }
};

exports.getAllGenres = async (req, res) => {
  try {
    const genres = await Genre.findAll();
    res.render("genres/listGenres", { genres });
  } catch (error) {
    console.error("Error fetching genres:", error);
    res.status(500).send("Error occurred while fetching genres");
  }
};

exports.getAddGenre = async (req, res) => {
  res.render("genres/addGenre");
};

exports.postNewGenre = async (req, res) => {
  try {
    const { name } = req.body; // Adjust according to your fields
    await Genre.create({ name });
    res.redirect("/genres");
  } catch (error) {
    console.error("Error creating genre:", error);
    res.status(500).send("Error occurred while creating a genre");
  }
};

exports.getGenre = async (req, res) => {
  try {
    const genre = await Genre.findByPk(req.params.id);
    if (!genre) {
      return res.status(404).send("Genre not found");
    }
    res.render("genres/editGenre", { genre });
  } catch (error) {
    console.error("Error fetching genre:", error);
    res.status(500).send("Error occurred while fetching genre");
  }
};

exports.putEditGenre = async (req, res) => {
  console.log("Edit Genre");
  try {
    const { name } = req.body; // Adjust according to your fields
    await Genre.update(
      { name },
      {
        where: { id: req.params.id },
      }
    );
    res.redirect("/genres");
  } catch (error) {
    console.error("Error updating genres:", error);
    res.status(500).send("Error occurred while updating the genres");
  }
};
