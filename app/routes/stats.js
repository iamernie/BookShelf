const express = require("express");
const router = express.Router();
const statsController = require("../controllers/statsController");

router.get("/stats", statsController.showStats);
router.get("/getstats", statsController.getStats);

module.exports = router;
