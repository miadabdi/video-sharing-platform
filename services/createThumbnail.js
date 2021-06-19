const ffmpeg = require("fluent-ffmpeg");
const { thumbnailFolder } = require("../globals");

// setting binaries
ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);

module.exports = (videoFilePath, videoId, thumbnailOffset) => {
	const thumbnailFilename = `${videoId}-${Date.now()}-thumbnail.png`;

	// it takes a screenshot in any given second and saves it as thumbnail
	// 16:9 aspect ratio is maintained
	return new Promise((resolve, reject) => {
		ffmpeg(videoFilePath)
			.on("start", (commandLine) => {
				// console.log("Spawned Ffmpeg with command: " + commandLine);
			})
			.on("end", function thumbnailDone() {
				resolve({ filename: thumbnailFilename });
			})
			.on("error", function thumbnailError(err) {
				reject(err);
			})
			.screenshot({
				filename: thumbnailFilename,
				folder: thumbnailFolder,
				size: "640x360",
				timestamps: [thumbnailOffset],
				// takes 1 screenshot in second thumbnailOffset
			});
	});
};
