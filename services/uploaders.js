const multer = require("multer");
const Path = require("path");
const sharp = require("sharp");
const mime = require("mime-types");
const CatchAsync = require("../utilities/CatchAsync");
const AppError = require("../utilities/AppError");

const storageFatory = (uploadDir) => {
	// req object should contain user data whose requesting
	return multer.diskStorage({
		destination: (req, file, cb) => {
			cb(null, uploadDir);
		},
		filename: (req, file, cb) => {
			let ext = Path.extname(file.originalname);
			const fileName = Path.basename(file.originalname, ext);
			ext = ext.substr(1);
			cb(null, `${fileName.replace(/\s/g, "-")}-${req.user._id}-${Date.now()}.${ext}`);
		},
	});
};

const filterFactory = (allowedToUpload) => {
	return (req, file, cb) => {
		if (allowedToUpload.includes(file.mimetype.split("/")[0])) {
			cb(null, true);
		} else {
			cb(new AppError(`Only ${allowedToUpload.join(" and")} are allowed!`, 400));
		}
	};
};

exports.thumbnailUploader = multer({
	storage: multer.memoryStorage(),
	fileFilter: filterFactory(["image"]),
	limits: { fileSize: process.env.MAX_IMAGE_SIZE_UPLOAD * 1024 * 1024 },
});

exports.captionUploader = multer({
	storage: storageFatory(Path.join(__dirname, "../storage/captions")),
	fileFilter: filterFactory(["text", "application"]),
	limits: { fileSize: process.env.MAX_CAPTION_SIZE_UPLOAD * 1024 * 1024 },
});

exports.videoUploader = multer({
	storage: storageFatory(Path.join(__dirname, "../storage/videos")),
	fileFilter: filterFactory(["video"]),
	limits: { fileSize: process.env.MAX_VIDEO_SIZE_UPLOAD * 1024 * 1024 },
});

exports.avatarUploader = multer({
	storage: multer.memoryStorage(),
	fileFilter: filterFactory(["image"]),
	limits: { fileSize: process.env.MAX_IMAGE_SIZE_UPLOAD * 1024 * 1024 },
});

exports.avatarHandler = CatchAsync(async (req, res, next) => {
	// no image received
	if (!req.file) {
		delete req.body.avatar;
		return next();
	}
	// resizing image
	const ext = mime.extension(req.file.mimetype);
	const filename = `avatar-${req.user._id}-${Date.now()}${ext ? `.${ext}` : ""}`;
	const path = Path.resolve("public/img", filename);

	await sharp(req.file.buffer, { failOnError: false }).resize(300, 300).toFile(path);

	req.body.avatar = filename;
	next();
});
