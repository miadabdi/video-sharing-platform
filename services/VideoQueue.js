const Ffmpeg = require("fluent-ffmpeg");
const { spawn } = require("child_process");
const Queue = require("bull");
const Path = require("path");

const {
	setVideoToProcessing,
	setVideoToWaiting,
	videoTranscodingCompleted,
	setVideoToFailed,
} = require("../controller/video");

// clearing the redis db in starting ----------------------------
const videoQueue = new Queue("video transcoding queue", "redis://127.0.0.1:6379");
videoQueue.clean(0, "delayed");
videoQueue.clean(0, "wait");
videoQueue.clean(0, "active");
videoQueue.clean(0, "completed");
videoQueue.clean(0, "failed");

// FIXME: we should not clear redis on restarts
// There should be retrial for errors for some time
// and if system restarts in the middle of a process
// it should be retried

const multi = videoQueue.multi();
multi.del(videoQueue.toKey("repeat"));
multi.exec();
// ---------------------------------------------------------------

// setting binaries
Ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
Ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);

const videoFolder = Path.join(__dirname, "../storage/videos");

function transcodeVideo(job) {
	const { videoFilename, dedicatedDir } = job.data;
	const dedicatedDirPath = Path.join(videoFolder, dedicatedDir);

	return new Promise((resolve, reject) => {
		// options for spawn
		const options = [
			`-loglevel error`,
			`-y`,
			`-i '../${videoFilename}'`,
			`-filter_complex "[0:v]fps=fps=30,split=3[v1][v2][v3];[v1]scale=width=-2:height=1080[1080p];[v2]scale=width=-2:height=720[720p];[v3]scale=width=-2:height=360[360p]"`,
			`-codec:v libx264`,
			`-crf:v 23`,
			`-profile:v high`,
			`-pix_fmt:v`,
			`yuv420p`,
			`-rc-lookahead:v 60`,
			`-force_key_frames:v expr:'gte(t,n_forced*2.000)'`,
			`-b-pyramid:v "strict"`,
			`-preset:v "medium"`,
			`-map [1080p]`,
			`-maxrate:v:0 2000000`,
			`-bufsize:v:0 2*2000000`,
			`-level:v:0 4.0`,
			`-map [720p]`,
			`-maxrate:v:1 1200000`,
			`-bufsize:v:1 2*1000000`,
			`-level:v:1 3.1`,
			`-map [360p]`,
			`-maxrate:v:2 700000`,
			`-bufsize:v:2 2*500000`,
			`-level:v:2 3.1`,
			`-codec:a aac`,
			`-ac:a 2`,
			`-map 0:a:0`,
			`-b:a:0 192000`,
			`-map 0:a:0`,
			`-b:a:1 128000`,
			`-map 0:a:0`,
			`-b:a:2 96000`,
			`-f hls`,
			`-hls_flags +independent_segments+program_date_time+single_file`,
			`-hls_time 6`,
			`-hls_playlist_type vod`,
			`-hls_segment_type mpegts`,
			`-master_pl_name 'master.m3u8'`,
			`-var_stream_map`,
			`"v:0,a:0,name:1080p v:1,a:1,name:720p v:2,a:2,name:360p"`,
			`-hls_segment_filename 'segment_%v.ts' 'manifest_%v.m3u8'`,
		];

		// FIXME: make ffmpeg use less memory
		// maybe streams will do the job

		// creating spawn
		const command = spawn("nice -n 19 ffmpeg", options, {
			shell: true,
			cwd: dedicatedDirPath,
		});

		command.stdout.on("data", (data) => {
			// console.log(`stdout: ${data}`);
		});

		command.on("close", (code) => {
			// console.log(`child process closed with code ${code}`);
			resolve();
		});

		command.on("error", (err) => {
			reject(err);
		});
	});
}

videoQueue.process((job) => {
	return transcodeVideo(job);
});

videoQueue.on("active", async function jobActivate(job, jobPromise) {
	await setVideoToProcessing(job.id);
});

videoQueue.on("waiting", async function jobWaiting(jobId) {
	// A Job is waiting to be processed as soon as a worker is idling.
	await setVideoToWaiting(jobId);
});

videoQueue.on("failed", async function jobFailed(job, err) {
	await setVideoToFailed(job.id);
	job.remove();
});

videoQueue.on("progress", function jobProgress(job, progress) {
	// console.log(`PROGRESS: ${progress}`);
});

videoQueue.on("completed", async function jobCompleted(job, result) {
	await videoTranscodingCompleted(job.id);
	job.remove();
});

module.exports = videoQueue;
