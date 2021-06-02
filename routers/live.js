const express = require("express");

const { protect, isLoggedIn } = require("../controller/auth");

const { thumbnailUploader } = require("../services/uploaders");

const { publish, publishDone, createLive, getLive } = require("../controller/live");

const router = express.Router();

router.get("/:id", isLoggedIn, getLive);
router.post("/publish", publish);
router.post("/publishDone", publishDone);

router.use(protect);
router.post("/", thumbnailUploader.single("thumbnail"), createLive);

module.exports = router;
