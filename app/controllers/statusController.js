const Status = require("../models/Status");

exports.JSONgetAllStatuses = async (req, res) => {
  try {
    const statuses = await Status.findAll({
      order: [["name", "ASC"]],
    });
    res.json(statuses); // Send the statuses as JSON
  } catch (error) {
    console.error("Error fetching statuses:", error);
    res.status(500).send("Error occurred while fetching statuses");
  }
};
