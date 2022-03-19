const CatchAsync = require("../utilities/CatchAsync");
const Playlist = require("../models/Playlist");
const filterObject = require("../utilities/filterObject");
const AppError = require("../utilities/AppError");
const { ownsChannel, pushPlaylist } = require("./channel");

const ownsPlaylist = async (user, playlistId = undefined, playlist) => {
	// if videoId is passed, we fetch the video document
	// if the actual document is passed, we don't
	// just reducing the calls to database
	if (playlistId) {
		playlist = await Playlist.findById(playlistId);
	}

	return ownsChannel(user, playlist.channel);
};

exports.createPlaylist = CatchAsync(async (req, res, next) => {
	req.body = filterObject(req.body, "name", "description", "channel", "privacy");

	if (!(await ownsChannel(req.user, req.body.channel))) {
		return next(new AppError("You don't own this channel", 403));
	}

	const playlist = await Playlist.create(req.body);

	await pushPlaylist(playlist.channel, playlist._id);

	res.status(201).json({
		status: "success",
		message: "Playlist created successfully",
		data: {
			playlist,
		},
	});
});

exports.updatePlaylist = CatchAsync(async (req, res, next) => {
	const { playlistId } = req.params;

	req.body = filterObject(req.body, "name", "description", "channel", "privacy");

	const playlist = await Playlist.findById(playlistId);

	if (!playlist) {
		return next(new AppError("Playlist not found", 400));
	}

	if (!(await ownsPlaylist(req.user, undefined, playlist))) {
		return next(new AppError("You don't own this playlist", 403));
	}

	playlist.set(req.body);
	await playlist.save();

	res.status(200).json({
		status: "success",
		message: "Playlist updated successfully",
		data: {
			playlist,
		},
	});
});

exports.deletePlaylist = CatchAsync(async (req, res, next) => {
	const { playlistId } = req.params;

	const playlist = await Playlist.findById(playlistId);

	if (!(await ownsPlaylist(req.user, undefined, playlist))) {
		return next(new AppError("You don't own this playlist", 403));
	}

	playlist.set({ isDeleted: true });
	await playlist.save();

	res.status(204).json({
		status: "success",
		message: "Playlist deleted successfully",
		data: {
			playlist,
		},
	});
});

exports.addToPlaylist = CatchAsync(async (req, res, next) => {
	const { playlistId } = req.params;

	if (!req.body.videoId) {
		return next(new AppError("VideoId should be provided", 400));
	}

	const playlist = await Playlist.findById(playlistId);

	if (!(await ownsPlaylist(req.user, undefined, playlist))) {
		return next(new AppError("You don't own this playlist", 403));
	}

	playlist.videos.push(req.body.videoId);
	await playlist.save();

	res.status(200).json({
		status: "success",
		message: `Video added to ${playlist.name}`,
	});
});

exports.getPlaylist = CatchAsync(async (req, res, next) => {
	const { playlistId } = req.params;

	const playlist = await Playlist.findById(playlistId);

	if (playlist.privacy === "Private" && !(await ownsPlaylist(req.user, undefined, playlist))) {
		return next(new AppError("This playlist is private", 403));
	}

	res.status(200).json({
		status: "success",
		data: {
			playlist,
		},
	});
});

exports.removeFromPlaylist = CatchAsync(async (req, res, next) => {
	const { playlistId } = req.params;

	if (!req.body.videoId) {
		return next(new AppError("VideoId should be provided", 400));
	}

	const playlist = await Playlist.findById(playlistId);

	if (!(await ownsPlaylist(req.user, undefined, playlist))) {
		return next(new AppError("You don't own this playlist", 403));
	}

	const index = playlist.videos.indexOf(req.body.videoId);
	if (index !== -1) {
		playlist.videos.splice(index, 1);
		await playlist.save();
	} else {
		return next(new AppError("This video does not exist in playlist", 400));
	}

	res.status(200).json({
		status: "success",
		message: `Video removed from ${playlist.name}`,
	});
});
