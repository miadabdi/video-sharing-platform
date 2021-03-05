const express = require("express");

const { 
    updateInfo,
    subscribe,
    unsubscribe,
    likeVideo,
    dislikeVideo,
    removeDislikeVideo,
    removeLikedVideo,
    addToWatched
} = require("../controller/user");

const {
    avatarHandler,
    avatarUploader
} = require('../services/uploaders');

const { protect } = require("../controller/auth");

const router = express.Router();

router.use(protect);
router.patch("/update-me", avatarUploader.single('avatar'), avatarHandler, updateInfo);
router.post('/subscribe/:channelId', subscribe);
router.post('/unsubscribe/:channelId', unsubscribe);
router.post('/like/:videoId', likeVideo);
router.post('/dislike/:videoId', dislikeVideo);
router.post('/removeliked/:videoId', removeLikedVideo);
router.post('/removedisliked/:videoId', removeDislikeVideo);
router.post('/addtowatched/:videoId', addToWatched);

module.exports = router;