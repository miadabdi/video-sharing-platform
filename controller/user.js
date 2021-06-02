const UserModel = require("../models/User");
const CatchAsync = require("../utilities/CatchAsync");
const AppError = require("../utilities/AppError");
const filterObject = require("../utilities/filterObject");
const { pushSubscriber, removeSubscriber } = require("./channel");
const {
	addToLikes,
	removeFromLikes,
	addToDislikes,
	removeFromDislikes,
	icreamentView,
} = require("./video");

exports.pushChannel = (userId, channelId) => {
	// pushing the newly uploaded video to videos array
	return UserModel.findByIdAndUpdate(
		userId,
		{
			$push: { channels: channelId },
		},
		{
			new: true,
			runValidators: true,
		}
	);
};

exports.removeDislikeVideo = CatchAsync(async (req, res, next) => {
	const { videoId } = req.params;

	const index = req.user.dislikedVideos.indexOf(videoId);

	// if the video is in the dislikedVideos array we remove it
	if (index > -1) {
		req.user.dislikedVideos.splice(index, 1);
		await req.user.save();

		await removeFromDislikes(videoId, req.user._id);

		return res.status(200).json({
			status: "success",
			message: "Video deleted from disliked videos",
		});
	}

	res.status(400).json({
		status: "fail",
		message: "Video is not in disliked videos",
	});
});

exports.removeLikedVideo = CatchAsync(async (req, res, next) => {
	const { videoId } = req.params;

	const index = req.user.likedVideos.indexOf(videoId);

	// if the video is in the likedVideos array we remove it
	if (index > -1) {
		req.user.likedVideos.splice(index, 1);
		await req.user.save();

		await removeFromLikes(videoId, req.user._id);

		return res.status(200).json({
			status: "success",
			message: "Video deleted from liked videos",
		});
	}

	res.status(400).json({
		status: "fail",
		message: "Video is not in liked videos",
	});
});

exports.dislikeVideo = CatchAsync(async (req, res, next) => {
	const { videoId } = req.params;

	const indexLike = req.user.likedVideos.indexOf(videoId);
	if (indexLike > -1) {
		// video exists in like, cannot add it to dislikes
		return next(new AppError("Video exists in like, cannot add it to dislikes", 400));
	}

	const indexDislike = req.user.dislikedVideos.indexOf(videoId);
	// if the video is in the dislikedVideos array, we can't add it
	if (indexDislike === -1) {
		req.user.dislikedVideos.push(videoId);
		await req.user.save();

		await addToDislikes(videoId, req.user._id);

		return res.status(200).json({
			status: "success",
			message: "Video added to disliked videos",
		});
	}

	res.status(400).json({
		status: "fail",
		message: "Video is already in disliked videos",
	});
});

exports.likeVideo = CatchAsync(async (req, res, next) => {
	const { videoId } = req.params;

	const indexDislike = req.user.dislikedVideos.indexOf(videoId);
	if (indexDislike > -1) {
		return next(new AppError("Video exists in dislikes, cannot add it to likes", 400));
	}

	const indexLike = req.user.likedVideos.indexOf(videoId);
	// if the video is in the likedVideos array, we can't add it
	if (indexLike === -1) {
		req.user.likedVideos.push(videoId);
		await req.user.save();

		await addToLikes(videoId, req.user._id);

		return res.status(200).json({
			status: "success",
			message: "Video added to liked videos",
		});
	}

	res.status(400).json({
		status: "fail",
		message: "Video is already added to liked videos",
	});
});

exports.addToWatched = CatchAsync(async (req, res, next) => {
	const { videoId } = req.params;

	const index = req.user.watched.indexOf(videoId);
	// if the video is in the watched array, we can't add it
	if (index === -1) {
		req.user.watched.push(videoId);
		await req.user.save();

		await icreamentView(videoId);

		return res.status(200).json({
			status: "success",
			message: "Video added to watched",
		});
	}

	res.status(400).json({
		status: "fail",
		message: "Video is already added to watched",
	});
});

exports.unsubscribe = CatchAsync(async (req, res, next) => {
	const { channelId } = req.params;

	const index = req.user.subscribes.indexOf(channelId);
	if (index > -1) {
		req.user.subscribes.splice(index, 1);
		await req.user.save();

		await removeSubscriber(channelId, req.user._id);

		return res.status(200).json({
			status: "success",
			message: "Unsubscribed successfully",
		});
	}

	res.status(400).json({
		status: "fail",
		message: "You are not subscribed",
	});
});

exports.subscribe = CatchAsync(async (req, res, next) => {
	const { channelId } = req.params;

	if (req.user.subscribes.indexOf(channelId) === -1) {
		req.user.subscribes.push(channelId);
		await req.user.save();

		await pushSubscriber(channelId, req.user._id);

		return res.status(200).json({
			status: "success",
			message: "Subscribed successfully",
		});
	}

	res.status(400).json({
		status: "fail",
		message: "Already subscribed",
	});
});

exports.updateInfo = CatchAsync(async (req, res, next) => {
	// check if there is password field
	if (req.body.password || req.body.passwordConfirm) {
		return next(
			new AppError("Please use /api/user/update-password to update your password.", 400)
		);
	}

	// update profile
	const filteredObj = filterObject(req.body, "fullname", "email", "avatar");

	const updatedUser = await UserModel.findByIdAndUpdate(req.user._id, filteredObj, {
		new: true,
		runValidators: true,
	});

	// send back response
	res.status(200).json({
		status: "success",
		message: "Account updated successfully",
		data: {
			user: updatedUser,
		},
	});
});

exports.me = CatchAsync(async (req, res, next) => {
	// removing unnecessary fields
	req.user.password = undefined;
	req.user.__v = undefined;
	req.user.passwordChangedAt = undefined;

	res.status(200).json(req.user);
});
