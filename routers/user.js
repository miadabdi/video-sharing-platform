const express = require("express");
const { 
    updateInfo,
    subscribe,
    unsubscribe,
    likeVideo,
    dislikeVideo,
    removeDislikeVideo,
    removeLikedVideo
} = require("../controller/user");

const {
    avatarUploader, 
    avatarHandler
} = require('../services/avatarUploader');

const { protect } = require("../controller/auth");

const router = express.Router();

router.use(protect);
router.patch("/update-me", avatarUploader.single('avatar'), avatarHandler, updateInfo);
router.get('/subscribe/:channelId', subscribe);
router.get('/unsubscribe/:channelId', unsubscribe);
router.get('/like/:videoId', likeVideo);
router.get('/dislike/:videoId', dislikeVideo);
router.get('/removeliked/:videoId', removeLikedVideo);
router.get('/removedisliked/:videoId', removeDislikeVideo);

module.exports = router;