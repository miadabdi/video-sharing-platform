const mongoose = require("mongoose");

const PlaylistSchema = new mongoose.Schema({
	channel: {
		ref: "Channel",
		type: mongoose.SchemaTypes.ObjectId,
	},
	name: {
		type: String,
		required: [true, "Name is required"],
		minlength: 3,
		maxlength: 60,
	},
	description: {
		type: String,
		minlength: 20,
		maxlength: 180,
	},
	videos: [
		{
			type: mongoose.SchemaTypes.ObjectId,
			ref: "Video",
		},
	],
	privacy: {
		type: String,
		enum: ["Public", "Private"],
		default: "Private",
	},
	isDeleted: {
		type: Boolean,
		default: false,
	},
});

const Playlist = mongoose.model("Playlist", PlaylistSchema);

module.exports = Playlist;
