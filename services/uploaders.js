const multer = require("multer");
const path = require("path");
const AppError = require("../utilities/AppError");


const storageFatory = (uploadDir) => {
    // req object should contain user data whose requesting
    return multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            let ext = path.extname(file.originalname);
            const fileName = path.basename(file.originalname, ext);
            ext = ext.substr(1);
            cb(
                null,
                `${fileName.replace(/\s/g, "-")}-${req.user._id}-${Date.now()}.${ext}`
            );
        },
    })
};

const filterFactory = (allowedToUpload) => {
    return (req, file, cb) => {
        if (allowedToUpload.includes(file.mimetype.split("/")[0])) {
            cb(null, true);
        } else {
            cb(new AppError(`Only ${allowedToUpload.join(' and')} are allowed!`, 400));
        }
    }
};

exports.thumbnailUploader = multer({
    storage: multer.memoryStorage(),
    fileFilter: filterFactory(['image']),
    limits: { fileSize: process.env.MAX_IMAGE_SIZE_UPLOAD * 1024 * 1024 }
});

exports.captionUploader = multer({
    storage: storageFatory('./public/video/captions'),
    fileFilter: filterFactory(['text', 'application']),
    limits: { fileSize: process.env.MAX_CAPTION_SIZE_UPLOAD * 1024 * 1024 }
});
