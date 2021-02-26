const express = require('express');

const videoUploader = require('../services/videoUploader');

const {
    protect,
    isLoggedIn
} = require('../controller/auth');

const router = express.Router();

const { 
    createVideo,
    updateVideo,
    getVideo,
    startTranscoding,
    publish,
    streamVideo,
    deleteVideo
} = require('../controller/video');


router.get('/:id', isLoggedIn, getVideo);
router.get('/stream/:id/:resolution', streamVideo);

router.use(protect);
router.post('/', videoUploader.single('video'), createVideo);
router.patch('/:id', updateVideo);
router.post('/:id/startTranscoding', startTranscoding);
router.post('/:id/publish', publish);
router.delete('/:id', deleteVideo);

module.exports = router;
