const multer = require("multer");
const slugify = require("slugify");

// Custom storage engine
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const { title, seriesId, bookNum } = req.body;
    const fileExtension = file.originalname.split(".").pop();
    const slugTitle = slugify(title || "", { lower: true, strict: true });
    const slugSeriesId = slugify(seriesId || "", { lower: true, strict: true });

    cb(null, `${slugTitle}_${slugSeriesId}_${bookNum}.${fileExtension}`);
  },
});

const upload = multer({ storage: storage });

module.exports = upload;
