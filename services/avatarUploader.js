const multer = require('multer');
const Path = require('path');
const sharp = require('sharp');
const mime = require("mime-types");
const CatchAsync = require("../utilities/CatchAsync");
const AppError = require("../utilities/AppError");

const storage = multer.memoryStorage();

const allowedToUpload = ["image"];
const filter = (req, file, cb) => {
    if (allowedToUpload.includes(file.mimetype.split("/")[0])) {
        cb(null, true);
    } else {
        cb(new AppError("Only images are allowed!", 400));
    }
};

exports.avatarUploader = multer({
    storage,
    fileFilter: filter,
    limits: { fileSize: process.env.MAX_IMAGE_SIZE_UPLOAD * 1024 * 1024 },
});

exports.avatarHandler = CatchAsync(async(req, res, next) => {
    // no image received
    if (!req.file) {
        delete req.body.avatar;
        return next();
    }
    // resizing image
    const ext = mime.extension(req.file.mimetype);
    const filename = `avatar-${req.user._id}-${Date.now()}${ext ? "." + ext : ""}`;
    const path = Path.resolve('public/img', filename);

    await sharp(
        req.file.buffer, 
        { failOnError: false })
        .resize(300, 300)
        .toFile(path);

    req.body.avatar = filename;
    next();
});