const ffmpeg = require("fluent-ffmpeg");

module.exports = (absolutePath) => {
	// using ffprobe we get details of a video file
	return new Promise((resolve, reject) => {
		ffmpeg.ffprobe(absolutePath, (err, data) => {
			if (err) return reject(err);
			resolve(data);
		});
	});
};
