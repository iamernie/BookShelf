const Format = require("../models/Format"); // Adjust the path as necessary

exports.getAllFormats = async (req, res) => {
  try {
    const formats = await Format.findAll();
    res.render("formats/listFormats", { formats });
  } catch (error) {
    console.error("Error fetching formats:", error);
    res.status(500).send("Error occurred while fetching formats");
  }
};

exports.getEditFormat = async (req, res) => {
  try {
    const format = await Format.findByPk(req.params.id);
    if (format) {
      res.render("formats/editFormat", { format });
    } else {
      res.status(404).send("Format not found");
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Server error");
  }
};

exports.postNewFormat = (req, res) => {
  res.render("formats/addFormat");
};

exports.putEditFormat = async (req, res) => {
  try {
    const { name } = req.body; // Adjust according to your fields
    await Format.update(
      { name },
      {
        where: { id: req.params.id },
      }
    );
    res.redirect("/formats");
  } catch (error) {
    console.error("Error updating format:", error);
    res.status(500).send("Error occurred while updating the format");
  }
};

exports.deleteFormat = async (req, res) => {
  try {
    await Format.destroy({
      where: { id: req.params.id },
    });
    res.redirect("/formats");
  } catch (error) {
    console.error("Error deleting format:", error);
    res.status(500).send("Error occurred while deleting the format");
  }
};
