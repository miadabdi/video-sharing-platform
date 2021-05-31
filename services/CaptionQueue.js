const Ffmpeg = require('fluent-ffmpeg');
const { default: slugify } = require('slugify');
const { spawn } = require('child_process');
const Queue = require('bull');
const Path = require('path');


const { 
    captionTranscodingCompleted,
} = require('../controller/video');


// clearing the redis db in starting ----------------------------
const captionQueue = new Queue('caption transcoding queue', 'redis://127.0.0.1:6379');
captionQueue.clean(0, 'delayed');
captionQueue.clean(0, 'wait');
captionQueue.clean(0, 'active');
captionQueue.clean(0, 'completed');
captionQueue.clean(0, 'failed');

let multi = captionQueue.multi();
multi.del(captionQueue.toKey('repeat'));
multi.exec();
// ---------------------------------------------------------------

// setting binaries
Ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
Ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);



const videoFolder = Path.join(__dirname, '../storage/videos');
const captionFolder = Path.join(__dirname, '../storage/captions');

function transcodeSubtitle(job) {
    const dedicatedDir = job.data.dedicatedDir;
    const dedicatedDirPath = Path.join(videoFolder, dedicatedDir);
    const subtitleFilename = job.data.subtitleFilename;
    const subtitlePath = Path.join(captionFolder, subtitleFilename);

    // variable video1080 is hardcoded.
    // any change to this or the ffmpeg commands may result in errors 
    const video1080 = `segment_1080p.ts`;

    const sub_code = job.data.sub_code;
    const sub_name = job.data.sub_name;

    const sub_name_slugified = slugify(sub_name, { remove: /(\(|\))/g });
    const captionM3u8Filename = `sub_${sub_name_slugified}.m3u8`;

    return new Promise((resolve, reject) => {

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
            `-hls_segment_filename 'redundant_%v.ts' 'sub_%v.m3u8'`
        ];

        const command = spawn('ffmpeg', options, {
            shell: true,
            cwd: dedicatedDirPath
        });


        command.stdout.on('data', (data) => {
            // console.log(`stdout: ${data}`);
        });

        command.on('close', (code) => {
            // console.log(`child process closed with code ${code}`);
            resolve({
                sub_code,
                sub_name,
                masterPath: Path.join(dedicatedDirPath, `master.m3u8`),
                captionFilename: subtitleFilename,
                dedicatedDirPath,
                captionM3u8Filename
            });
        });

        command.on('error', (err) => {
            console.error(err);
            reject(err);
        })

    });
}

captionQueue.process((job) => {
    return transcodeSubtitle(job);
});

captionQueue.on('active', async function(job, jobPromise) {});

captionQueue.on('waiting', async function(jobId){
    // A Job is waiting to be processed as soon as a worker is idling.
});

captionQueue.on('failed', async function(job, err) {
    job.remove();
});

captionQueue.on('progress', function(job, progress) {
    // console.log(`PROGRESS: ${progress}`);
});

captionQueue.on('completed', async function(job, result) {
    await captionTranscodingCompleted(job.id, result);
    job.remove();
});

module.exports = captionQueue;



/*

ffmpeg -i ../20210326_125609.mp4 \
-filter_complex \
"[0:v]fps=fps=30,split=3[v1][v2][v3]; \
[v1]scale=width=-2:height=1080[1080p]; [v2]scale=width=-2:height=720[720p]; [v3]scale=width=-2:height=360[360p]" \
-codec:v libx264 -crf:v 23 -profile:v high -pix_fmt:v yuv420p -rc-lookahead:v 60 -force_key_frames:v expr:'gte(t,n_forced*2.000)' -preset:v "medium" -b-pyramid:v "strict"  \
-map [1080p] -maxrate:v:0 2000000 -bufsize:v:0 2*2000000 -level:v:0 4.0 \
-map [720p] -maxrate:v:1 1200000 -bufsize:v:1 2*1000000 -level:v:1 3.1 \
-map [360p] -maxrate:v:2 700000 -bufsize:v:2 2*500000 -level:v:2 3.1 \
-codec:a libfdk_aac -ac:a 2 \
-map 0:a:0 -b:a:0 192000 \
-map 0:a:0 -b:a:1 128000 \
-map 0:a:0 -b:a:2 96000 \
-f hls \
-hls_flags +independent_segments+program_date_time+single_file \
-hls_time 6 \
-hls_playlist_type vod \
-hls_segment_type mpegts \
-master_pl_name 'master.m3u8' \
-var_stream_map \'v:0,a:0,name:1080p v:1,a:1,name:720p v:2,a:2,name:360p\' \
-hls_segment_filename 'segment_%v_%05d.ts' 'manifest_%v.m3u8'




ffmpeg -i segment_360p.ts -i ../sub1.srt \
-c:v copy \
-c:s webvtt \
-map 0:v \
-map 1:s \
-shortest \
-f hls \
-hls_flags +independent_segments+program_date_time+single_file \
-hls_time 6 \
-hls_playlist_type vod \
-hls_subtitle_path sub_eng.m3u8 \
-hls_segment_type mpegts \
-var_stream_map 'v:0,s:0,name:Spanish,sgroup:subtitle' \
-hls_segment_filename 'redundant_%v.ts' sub_%v.m3u8

*/

