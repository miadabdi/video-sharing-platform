const express = require("express");

const { thumbnailUploader, captionUploader, videoUploader } = require("../services/uploaders");

const { protect, isLoggedIn } = require("../controller/auth");

const router = express.Router();

const {
	createVideo,
	updateVideo,
	getVideo,
	startTranscoding,
	publish,
	deleteVideo,
	setThumbnail,
	addCaption,
} = require("../controller/video");

router.get("/:id", isLoggedIn, getVideo);

router.use(protect);
router.post("/", videoUploader.single("video"), createVideo);
router.patch("/:id", updateVideo);
router.post("/:id/startTranscoding", startTranscoding);
router.post("/:id/publish", publish);
router.post("/:id/setThumbnail", thumbnailUploader.single("thumbnail"), setThumbnail);
router.post("/:id/addCaption", captionUploader.single("caption"), addCaption);
router.delete("/:id", deleteVideo);

module.exports = router;
