const Ffmpeg = require("fluent-ffmpeg");
const { default: slugify } = require("slugify");
const { spawn } = require("child_process");
const Queue = require("bull");
const Path = require("path");
const { videoFolder, captionFolder } = require("../globals");

const { captionTranscodingCompleted } = require("../controller/video");

// clearing the redis db in starting ----------------------------
const captionQueue = new Queue("caption transcoding queue", "redis://127.0.0.1:6379");
captionQueue.clean(0, "delayed");
captionQueue.clean(0, "wait");
captionQueue.clean(0, "active");
captionQueue.clean(0, "completed");
captionQueue.clean(0, "failed");

const multi = captionQueue.multi();
multi.del(captionQueue.toKey("repeat"));
multi.exec();
// ---------------------------------------------------------------

// setting binaries
Ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
Ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);

function transcodeSubtitle(job) {
	const { dedicatedDir, subtitleFilename } = job.data;
	const dedicatedDirPath = Path.join(videoFolder, dedicatedDir);
	const subtitlePath = Path.join(captionFolder, subtitleFilename);

	// variable video1080 is hardcoded.
	// any change to this or the ffmpeg commands may result in errors
	const video1080 = `segment_1080p.ts`;

	// sub_code is the code and sub_name is the name of the language in RFC5646
	const { sub_code, sub_name } = job.data;

	// name is slugified because it is used for the name of the vtt file
	// and the captionM3u8Filename is used for the m3u8 file
	// so these will be file name and it is better not to have spaces in them
	const sub_name_slugified = slugify(sub_name, { remove: /(\(|\))/g });
	const captionM3u8Filename = `sub_${sub_name_slugified}.m3u8`;

	return new Promise((resolve, reject) => {
		// options of the spawn
		const options = [
			`-loglevel error`,
			`-y`,
			`-i '${video1080}'`,
			`-i '${subtitlePath}'`,
			`-c:v copy`,
			`-c:a copy`,
			`-c:s webvtt`,
			`-map 0:v`,
			`-map 1:s`,
			`-shortest`,
			`-f hls`,
			`-hls_flags +independent_segments+program_date_time+single_file`,
			`-hls_time 6`,
			`-hls_playlist_type vod`,
			`-hls_subtitle_path '${captionM3u8Filename}'`,
			`-hls_segment_type mpegts`,
			`-var_stream_map 'v:0,s:0,name:${sub_name_slugified},sgroup:subtitle'`,
			`-hls_segment_filename 'redundant_%v.ts' 'sub_%v.m3u8'`,
		];

		// creating the spawn
		const command = spawn("ffmpeg", options, {
			shell: true,
			cwd: dedicatedDirPath,
		});

		command.stdout.on("data", (data) => {
			// console.log(`stdout: ${data}`);
		});

		command.on("close", (code) => {
			// console.log(`child process closed with code ${code}`);
			resolve({
				sub_code,
				sub_name,
				masterPath: Path.join(dedicatedDirPath, `master.m3u8`),
				captionFilename: subtitleFilename,
				dedicatedDirPath,
				captionM3u8Filename,
			});
		});

		command.on("error", (err) => {
			// console.error(err);
			reject(err);
		});
	});
}

captionQueue.process((job) => {
	return transcodeSubtitle(job);
});

captionQueue.on("active", async function jobActivate(job, jobPromise) {
	// whenever a new job gets added
});

captionQueue.on("waiting", async function jobWaiting(jobId) {
	// A Job is waiting to be processed as soon as a worker is idling.
});

captionQueue.on("failed", async function jobFailed(job, err) {
	// TODO: when the job failes we move on and even don't have any functionality to retry
	// we don't even have the functionality to inform the user
	job.remove();
});

captionQueue.on("progress", function jobProgress(job, progress) {
	// console.log(`PROGRESS: ${progress}`);
});

captionQueue.on("completed", async function jobCompleted(job, result) {
	// when the job completes, the required information is sent to func below
	// to do essential things afterwards
	await captionTranscodingCompleted(job.id, result);
	job.remove();
});

module.exports = captionQueue;
