const sharp = require('sharp');
const crypto = require('crypto');
const Path = require('path');
const Live = require('../models/Live');
const AppError = require('../utilities/AppError');
const CatchAsync = require('../utilities/CatchAsync');
const filterObject = require('../utilities/filterObject');
const { ownsChannel } = require('./channel');

exports.getLive = CatchAsync(async (req, res, next) => {
    const live = await Live.findById(req.params.id).select('+streamKey');

    if (!live) {
        return next(new AppError('Live not found', 404));
    }

    if (live.status === 'Ended') {
        return next(new AppError('Live is over', 400));
    }

    if (!(req.user && ownsChannel(req.user, live.channel))) {
        live.streamKey = undefined;
    }

    res.status(200).json({
        status: 'success', 
        data: {
            live
        }
    });
});

exports.publish = CatchAsync(async (req, res, next) => {
    const streamKey = req.body.name;

    const live = await Live.findOne({ streamKey });
    if (!live) {
        return next(new AppError('Stream not found', 404));
    }

    if (live.status === 'Ended') {
        return next(new AppError('Stream is ended', 400));
    }

    const m3u8Filename = live.name.split(' ').join('_');
    live.m3u8File = `${m3u8Filename}.m3u8`;
    live.status = 'Streaming';
    await live.save();

    res.setHeader('Location', m3u8Filename);
    res.status(301).end();
});

exports.createLive = CatchAsync(async (req, res, next) => {

    if (!ownsChannel(req.user, req.body.channel)) {
        return next(new AppError('You don\'t own this channel', 401));
    }

    if (!req.file) {
        return next(new AppError('Thumbnail is required', 400));
    }

    req.body = filterObject(req.body,
        'name', 'description', 'channel'
    );

    req.body.streamKey = crypto.randomBytes(20).toString('hex');

    const thumbnailFilename = `live-${req.user._id}-${req.body.channel}-thumbnail.jpg`;

    await sharp(req.file.buffer)
        .resize(640, 360) // 16:9 aspect ratio
        .toFile(Path.join(__dirname, `../storage/thumbnails/${thumbnailFilename}`));

    req.body.thumbnail = thumbnailFilename;

    const live = await Live.create(req.body);

    res.status(201).json({
        status: 'success',
        message: 'Live created successfully',
        data: {
            live
        }
    });
});

exports.publishDone = CatchAsync(async (req, res, next) => {
    console.log(req.body);
    const streamKey = req.body.name;

    const live = await Live.findOne({ streamKey });
    if (!live) {
        return next(new AppError('Stream not found', 404));
    }

    live.status = 'Ended';
    live.m3u8File = undefined;
    await live.save();

    res.status(200).end();
});

