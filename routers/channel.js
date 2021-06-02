const express = require("express");

const { avatarUploader, avatarHandler } = require("../services/uploaders");

const { protect } = require("../controller/auth");

const router = express.Router();

const {
	createChannel,
	updateChannel,
	getChannel,
	deleteChannel,
} = require("../controller/channel");

router.get("/:id", getChannel);

router.use(protect);
router.delete("/:id", deleteChannel);
router.patch("/:id", avatarUploader.single("avatar"), avatarHandler, updateChannel);
router.post("/", avatarUploader.single("avatar"), avatarHandler, createChannel);

module.exports = router;
