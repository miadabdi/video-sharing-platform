const multer = require("multer");
const Path = require("path");
const AppError = require("../utilities/AppError");


const allowedToUpload = ["video"];
const uploadVideoDirectory = Path.join(__dirname, "../storage/videos");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadVideoDirectory);
    },
    filename: (req, file, cb) => {
        let ext = Path.extname(file.originalname);
        const fileName = Path.basename(file.originalname, ext);
        ext = ext.substr(1);
        cb(
            null,
            `${fileName.replace(/\s/g, "-")}-${req.user._id}-${Date.now()}.${ext}`
        );
    },
});

const filter = (req, file, cb) => {
    if (allowedToUpload.includes(file.mimetype.split("/")[0])) {
        cb(null, true);
    } else {
        cb(new AppError(`Only ${allowedToUpload.join(' and')} are allowed!`, 400));
    }
};

module.exports = multer({
    storage,
    fileFilter: filter,
    limits: { fileSize: process.env.MAX_VIDEO_SIZE_UPLOAD * 1024 * 1024 },
});
