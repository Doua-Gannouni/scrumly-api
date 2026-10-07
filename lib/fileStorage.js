const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");

// The images and files of the projects are saved in MongoDB (GridFS, bucket "uploads") and not on the disk
// of the server : they are kept with the data and survive the redeploys of the hosting (the disk of Render
// is erased at each deploy). A project saves the path "uploads/<file name>" of its files.
const BUCKET_NAME = "uploads";

// allowed extensions and their type : the declared type alone is not trusted (it is sent by the client)
const IMAGE_TYPES = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png" };
const FILE_TYPES = { ...IMAGE_TYPES, ".pdf": "application/pdf" };

const toSavedPath = (fileName) => `uploads/${fileName}`;
const toFileName = (savedPath) => path.posix.basename(savedPath);

const getBucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: BUCKET_NAME });

// Unique name of a stored file (random part so it cannot be guessed, extension in lowercase)
const buildFileName = (originalname) => {
  const originalName = Buffer.from(originalname, "latin1").toString("utf8");
  const extension = path.extname(originalName);
  const cleanName = path.basename(originalName, extension).replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${Date.now()}-${crypto.randomBytes(6).toString("hex")}-${cleanName}${extension.toLowerCase()}`;
};

// Stored file with this name, or null
const findFile = async (fileName) => {
  const [file] = await getBucket().find({ filename: fileName }).limit(1).toArray();
  return file || null;
};

// Stream to read a stored file
const openFile = (file) => getBucket().openDownloadStream(file._id);

// Delete stored files from their saved paths (a missing file is only logged)
const deleteFiles = async (savedPaths) => {
  for (const savedPath of savedPaths) {
    try {
      const file = await findFile(toFileName(savedPath));
      if (file) {
        await getBucket().delete(file._id);
      }
    } catch (err) {
      console.error(`Error while deleting the file ${savedPath}:`, err.message);
    }
  }
};

// Save an uploaded file (kept in memory by multer) in MongoDB, returns its path "uploads/<file name>"
const saveFile = (file) =>
  new Promise((resolve, reject) => {
    const fileName = buildFileName(file.originalname);
    getBucket()
      .openUploadStream(fileName, { metadata: { contentType: file.mimetype } })
      .on("error", reject)
      .on("finish", () => resolve(toSavedPath(fileName)))
      .end(file.buffer);
  });

// Save the uploaded files of a field, returns their paths (nothing is kept if one of them fails)
const saveUploadedFiles = async (files = []) => {
  const savedPaths = [];
  try {
    for (const file of files) {
      savedPaths.push(await saveFile(file));
    }
  } catch (err) {
    await deleteFiles(savedPaths);
    throw err;
  }
  return savedPaths;
};

module.exports = {
  IMAGE_TYPES,
  FILE_TYPES,
  toSavedPath,
  findFile,
  openFile,
  deleteFiles,
  saveUploadedFiles,
};
