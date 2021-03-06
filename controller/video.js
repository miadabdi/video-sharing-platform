const m3u8Parser = require("@miadabdi/m3u8-parser");
const slugify = require("slugify");
const fs = require("fs");
const sharp = require("sharp");
const Path = require("path");
const CatchAsync = require("../utilities/CatchAsync");
const AppError = require("../utilities/AppError");
const filterObject = require("../utilities/filterObject");
const { ownsChannel, pushVideo, isChannelDeleted } = require("./channel");
const Video = require("../models/Video");
const getVideoDetails = require("../utilities/getVideoDetails");
const generateThumbnail = require("../services/createThumbnail");
const getFilenameAndExt = require("../utilities/splitFilenameAndExt");
const APIFeatures = require("../utilities/APIFeatures");
const logger = require("../utilities/logger");

const videoFolder = Path.join(__dirname, "../storage/videos");

const getVideoDetailsInDesiredFormat = async (videoFilePath) => {
	const details = await getVideoDetails(videoFilePath);

	if (details.streams.length < 2) {
		// there is only one stream which probably there is only video
		throw new AppError(
			"This video does not contain any audio. Videos should contain audio",
			400
		);
	}

	const [num1, num2] = details.streams[0].avg_frame_rate.split("/");
	const frameRate = parseFloat((num1 / num2).toFixed(2));

	return {
		fileSize: details.format.size,
		frameRate,
		duration: details.format.duration,
	};
};

const ownsVideo = async (user, videoId = undefined, video) => {
	// if videoId is passed, we fetch the video document
	// if the actual document is passed, we don't
	// just reducing the calls to database
	if (videoId) {
		video = await Video.findById(videoId);
	}

	return ownsChannel(user, video.creator);
};

exports.getVideo = CatchAsync(async (req, res, next) => {
	const videoId = req.params.id;

	const video = await Video.findById(videoId);

	if (!video || video.isDeleted) {
		return next(new AppError("Video not found", 404));
	}

	if (!video.isPublished && !(await ownsChannel(req.user, video.creator))) {
		return next(new AppError("Video is not published yet", 403));
		// if you own the channel, you can see not published videos
	}

	res.status(200).json({
		status: "success",
		data: {
			video,
		},
	});
});

exports.setThumbnail = CatchAsync(async (req, res, next) => {
	if (!req.file) {
		return next(new AppError("Thumbnail is not provided", 400));
	}

	const video = await Video.findById(req.params.id);

	if (!video) {
		return next(new AppError("Video not found", 404));
	}

	if (!(await ownsVideo(req.user, undefined, video))) {
		return next(new AppError("You don'n own this video", 403));
	}

	const filename = `${video._id}-${Date.now()}-thumbnail.jpg`;

	await sharp(req.file.buffer)
		.resize(640, 360)
		.toFile(Path.join(__dirname, `../storage/thumbnails/${filename}`));

	video.thumbnail = filename;
	await video.save();

	res.status(200).json({
		status: "success",
		message: "Thumbnail changed successfully",
	});
});

exports.uploadVideo = CatchAsync(async (req, res, next) => {
	if (!req.file) {
		return next(new AppError("Video is not provided", 400));
	}

	res.status(201).json({
		status: "success",
		message: "Video uploaded successfully",
		data: {
			videoFilename: req.file.filename,
		},
	});
});

exports.createVideo = CatchAsync(async (req, res, next) => {
	let thumbnailOffset;
	if (req.body.thumbnailOffset || !Number.isNaN(req.body.thumbnailOffset)) {
		thumbnailOffset = Number(req.body.thumbnailOffset);
	}

	req.body = filterObject(
		req.body,
		"creator",
		"language",
		"title",
		"description",
		"videoFilename"
	);

	if (!(await ownsChannel(req.user, req.body.creator))) {
		return next(new AppError("You don'n own this channel", 403));
	}

	if (await isChannelDeleted(req.body.creator)) {
		return next(new AppError("This channel is deleted, no more videos can be uploaded", 400));
	}

	// FIXME: when video has got only one stream (audio is probably not there), we return an error. we should delete uploaded files
	const videoPath = Path.join(videoFolder, req.body.videoFilename);
	const videoDetails = await getVideoDetailsInDesiredFormat(videoPath);
	req.body.duration = videoDetails.duration;
	req.body.orgVideoFilename = req.body.videoFilename;

	// check if the thumbnail offset is in boundaries
	if (thumbnailOffset < 0) {
		return next(new AppError("thumbnailOffset should not be lower than 0", 400));
	}

	if (thumbnailOffset > videoDetails.duration) {
		return next(new AppError("thumbnailOffset should not be higher than video duration", 400));
	}

	// the slugified version of the video filename will be the folder name
	req.body.dedicatedDir = slugify(getFilenameAndExt(req.body.videoFilename)[0]);
	const dedicatedDirPath = Path.join(__dirname, `../storage/videos/${req.body.dedicatedDir}`);
	try {
		await fs.promises.mkdir(dedicatedDirPath);
	} catch (e) {
		// ignoring error EEXIST as it indecates the folder exists
		if (!e.code === "EEXIST") {
			throw e;
		}
	}

	req.body.thumbnail = "fake"; // This is a fake thumbnail so mongoose won't throw error
	const video = await Video.create(req.body);

	const { filename: thumbnail } = await generateThumbnail(
		videoPath,
		video._id,
		thumbnailOffset || video.duration / 2
		// if offset is not passed, screenshot will be taken from the middle of the video
	);
	video.thumbnail = thumbnail;
	await video.save();

	// add video to videos of channel
	await pushVideo(req.body.creator, video._id);

	res.status(201).json({
		status: "success",
		message: "Video created successfully",
		data: {
			video,
		},
	});
});

exports.updateVideo = CatchAsync(async (req, res, next) => {
	const videoId = req.params.id;

	const video = await Video.findById(videoId);

	if (!video || video.isDeleted) {
		return next(new AppError("Video not found", 404));
	}

	if (!(await ownsVideo(req.user, undefined, video))) {
		return next(new AppError("You don't own this video", 403));
	}

	req.body = filterObject(req.body, "creator", "language", "title", "description");

	video.set(req.body);

	await video.save();

	res.status(200).json({
		status: "success",
		message: "Video updated successfully",
		data: {
			video,
		},
	});
});

exports.publish = CatchAsync(async (req, res, next) => {
	const videoId = req.params.id;

	const video = await Video.findById(videoId);

	if (!video || video.isDeleted) {
		return next(new AppError("Video not found", 404));
	}

	if (!ownsVideo(req.user, undefined, video)) {
		return next(new AppError("You don't own this video", 403));
	}

	if (video.status !== "Ready to publish") {
		return next(
			new AppError(
				`Video status should be Ready to publish. but the current status is ${video.status}`,
				400
			)
		);
	}

	video.isPublished = true;
	video.status = "Published";
	await video.save();

	res.status(200).json({
		status: "success",
		message: "Video published successfully",
	});
});

exports.startTranscoding = CatchAsync(async (req, res, next) => {
	const videoId = req.params.id;

	const video = await Video.findById(videoId);

	if (!video || video.isDeleted) {
		return next(new AppError("Video not found", 404));
	}

	if (!ownsVideo(req.user, undefined, video)) {
		return next(new AppError("You don't own this video", 403));
	}

	if (video.status !== "Ready for processing") {
		return next(
			new AppError(
				`Video status should be Ready for processing. but the current status is ${video.status}`,
				400
			)
		);
	}

	// importing video queue here for avoiding cycling dependency
	// TODO: temparary should not be in this way
	const VideoQueue = require("../services/VideoQueue");

	VideoQueue.add(
		{
			videoFilename: video.orgVideoFilename,
			dedicatedDir: video.dedicatedDir,
		},
		{
			jobId: video._id,
		}
	);

	res.status(202).json({
		status: "success",
		message: "Video has been added to transcoding queue",
	});
});

async function deleteOneVideo(video) {
	if (!video || video.isDeleted) {
		throw new AppError("Video not found", 404);
	}

	await video.unlinkVideos();
	await video.unlinkOrgVideo();
	video.isDeleted = true;
	video.status = "Deleted";
	video.isPublished = false;
	await video.save();
}

exports.deleteManyVideos = async (videoIds) => {
	const videos = await Video.find({ _id: { $in: videoIds } });

	const videoPromises = videos.map((video) => deleteOneVideo(video));
	return Promise.allSettled(videoPromises);
};

exports.deleteVideo = CatchAsync(async (req, res, next) => {
	const videoId = req.params.id;

	const video = await Video.findById(videoId);

	if (!ownsVideo(req.user, undefined, video)) {
		return next(new AppError("You don't own this video", 403));
	}

	await deleteOneVideo(video);

	res.status(204).json({
		status: "success",
		message: "Video deleted successfully",
	});
});

exports.setVideoToProcessing = (videoId) => {
	return Video.findByIdAndUpdate(
		videoId,
		{
			status: "Processing",
		},
		{
			new: true,
		}
	);
};

exports.setVideoToWaiting = (videoId) => {
	return Video.findByIdAndUpdate(
		videoId,
		{
			status: "Waiting in queue",
		},
		{
			new: true,
		}
	);
};

exports.videoTranscodingCompleted = async (videoId, result) => {
	const video = await Video.findById(videoId);

	await video.unlinkOrgVideo();
	video.status = "Ready to publish";

	await video.save();
};

exports.setVideoToFailed = (videoId) => {
	return Video.findByIdAndUpdate(
		videoId,
		{
			status: "Failed in processing",
		},
		{
			new: true,
		}
	);
};

exports.addToDislikes = async (videoId, userId) => {
	const video = await Video.findById(videoId);
	video.addToDislikes(userId);
	await video.save();
};
exports.addToLikes = async (videoId, userId) => {
	const video = await Video.findById(videoId);
	video.addToLikes(userId);
	await video.save();
};
exports.removeFromDislikes = async (videoId, userId) => {
	const video = await Video.findById(videoId);
	video.removeFromDislikes(userId);
	await video.save();
};
exports.removeFromLikes = async (videoId, userId) => {
	const video = await Video.findById(videoId);
	video.removeFromLikes(userId);
	await video.save();
};

exports.icreamentView = (videoId) => {
	return Video.findByIdAndUpdate(
		videoId,
		{
			$inc: { views: 1 },
		},
		{
			new: 1,
		}
	);
};

exports.addCaption = CatchAsync(async (req, res, next) => {
	if (!req.file) {
		return next(new AppError("Caption file is not provided", 400));
	}

	const video = await Video.findById(req.params.id);
	if (!video || video.isDeleted) {
		return next(new AppError("Video not found", 404));
	}

	if (!(await ownsVideo(req.user, undefined, video))) {
		return next(new AppError("You don'n own this video", 403));
	}

	if (!["Ready to publish", "Published"].includes(video.status)) {
		return next(new AppError("Video should be processed to be able to add caption"), 400);
	}

	const caption = video.captions.create({
		filename: req.file.filename,
		languageInRFC5646: req.body.languageInRFC5646,
	});

	video.captions.push(caption);

	await video.save();

	// importing caption queue here for avoiding cycling dependency
	// TODO: temparary should not be in this way
	const CaptionQueue = require("../services/CaptionQueue");

	CaptionQueue.add(
		{
			subtitleFilename: caption.filename,
			dedicatedDir: video.dedicatedDir,
			sub_code: caption.languageInRFC5646,
			sub_name: caption.language,
		},
		{
			jobId: video._id,
		}
	);

	res.status(200).json({
		status: "success",
		message: "Caption saved successfully and soon will be processed",
	});
});

exports.captionTranscodingCompleted = async (jobId, result) => {
	// #EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subtitles0",NAME="eng_subtitle",DEFAULT=NO,AUTOSELECT=YES,LANGUAGE="eng",URI="subtitle_eng_rendition.m3u8"

	let masterData;
	try {
		masterData = await fs.promises.readFile(result.masterPath, { encoding: "utf8" });
	} catch (err) {
		logger.error("Error in opening master file", err, { filePath: result.masterPath });
	}

	// loading m3u8 master to parser
	const parser = new m3u8Parser.Parser();
	parser.push(masterData);
	parser.end();

	// group name subtitle0 is hardcoded. changing this may cause errors
	const subtitles0 = parser.manifest.mediaGroups.SUBTITLES.subtitles0 || {};
	subtitles0[result.sub_name] = {
		default: false,
		autoselect: false,
		forced: false,
		language: result.sub_code,
		uri: result.captionM3u8Filename,
	};

	// there will be only one subtitle group and it is called 'subtitles0'
	parser.manifest.mediaGroups.SUBTITLES.subtitles0 = subtitles0;

	parser.manifest.playlists = parser.manifest.playlists.map((playlist) => {
		// adding subtitle group to every variant in the master file
		playlist.attributes.SUBTITLES = "subtitles0";
		return playlist;
	});

	try {
		await fs.promises.writeFile(result.masterPath, parser.stringify(), {
			encoding: "utf8",
		});
	} catch (err) {
		logger.error("Error in writing master file", err, { filePath: result.masterPath });
	}

	// removing redundant files
	const path = result.dedicatedDirPath;
	const regex = /^redundant.*$/;
	const files = await fs.promises.readdir(path);
	files
		.filter((f) => regex.test(f))
		.map(async (f) => {
			await fs.promises.unlink(Path.join(path, f));
		});
};

exports.search = CatchAsync(async (req, res, next) => {
	const projection = {};
	if (req.query.keywords) {
		// performing text search on title and description fields if keywords is present
		req.query.$text = { $search: req.query.keywords };
		delete req.query.keywords;

		// adding score to the result
		projection.score = { $meta: "textScore" };

		// FIXME: sorting the score normally won't have any effect on backend
		// maybe because it is probably a vitual property
		// plus, the way to sort score that is shown is different
		// https://docs.mongodb.com/manual/text-search
		// req.query.sort = [req.query.sort, "score"].join("");
	}

	const query = new APIFeatures(Video, req.query, projection)
		.filter()
		.sort()
		.paginate()
		.excludeFields();

	const videos = await query.query;

	res.status(200).json({
		noResult: videos.length,
		videos,
	});
});
