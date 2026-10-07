const multer = require("multer");
const path = require("path");
const { BadRequestError } = require("../utils/appError");
const { IMAGE_TYPES, FILE_TYPES } = require("../lib/fileStorage");

// images : jpeg or png, files : jpeg, png or pdf
// the extension must match the declared type (the files are served with the type of their extension)
const fileFilter = (req, file, cb) => {
  const isImage = file.fieldname === "images";
  const allowedTypes = isImage ? IMAGE_TYPES : FILE_TYPES;
  const extension = path.extname(file.originalname).toLowerCase();

  if (allowedTypes[extension] && allowedTypes[extension] === file.mimetype) {
    cb(null, true);
  } else {
    cb(
      new BadRequestError(
        isImage ? "Image type not allowed (jpeg or png only)" : "File type not allowed (jpeg, png or pdf only)",
      ),
      false,
    );
  }
};

// multer keeps the uploaded files in memory (10 MB max each),
// then the controller saves them in MongoDB (lib/fileStorage.js)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter,
});

module.exports = upload;
