const Comment = require("../models/Comment");
const AppError = require("../utilities/AppError");
const CatchAsync = require("../utilities/CatchAsync");

exports.createReply = CatchAsync(async (req, res, next) => {
	const parentDoc = await Comment.findById(req.params.commentId).populate({
		path: "author",
		select: { _id: 1, fullname: 1 },
	});

	const reply = parentDoc.replies.create({
		content: req.body.content,
		author: req.user._id,
		replyTo: {
			user: parentDoc.author._id,
			fullname: parentDoc.author.fullname,
		},
	});

	// create method won't push it automatically, we have to do it
	parentDoc.replies.push(reply);
	await parentDoc.save();

	res.status(201).json({
		status: "success",
		data: {
			reply,
		},
	});
});

exports.createComment = CatchAsync(async (req, res, next) => {
	const comment = await Comment.create({
		video: req.body.video,
		content: req.body.content,
		author: req.user._id,
	});

	res.status(201).json({
		status: "success",
		data: {
			comment,
		},
	});
});

exports.updateComment = CatchAsync(async (req, res, next) => {
	const comment = await Comment.findById(req.params.commentId);

	if (!comment) {
		return next(new AppError("Comment not found", 404));
	}

	if (req.user._id.toString() !== comment.author.toString()) {
		return next(new AppError("You don't own this comment", 403));
	}

	comment.set({
		content: req.body.content,
		isEdited: true,
	});

	await comment.save();

	res.status(200).json({
		status: "success",
		data: {
			comment,
		},
	});
});

exports.updateReply = CatchAsync(async (req, res, next) => {
	const comment = await Comment.findById(req.params.commentId);

	if (!comment) {
		return next(new AppError("Comment not found", 404));
	}

	// getting the reply
	const reply = comment.replies.id(req.params.replyId);

	if (!reply) {
		return next(new AppError("Reply not found", 404));
	}

	if (req.user._id.toString() !== reply.author.toString()) {
		return next(new AppError("You don't own this reply", 403));
	}

	reply.set({
		content: req.body.content,
		isEdited: true,
	});

	await comment.save();

	res.status(200).json({
		status: "success",
		data: {
			reply,
		},
	});
});
