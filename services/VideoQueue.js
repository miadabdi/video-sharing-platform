const ffmpeg = require('fluent-ffmpeg');
const Queue = require('bull');
const Path = require('path');

const { 
    setVideoToProcessing,
    setVideoToWaiting,
    videoTranscodingCompleted,
    setVideoToFailed
} = require('../controller/video');


// clearing the redis db in starting ----------------------------
const videoQueue = new Queue('video transcoding queue', 'redis://127.0.0.1:6379');
videoQueue.clean(0, 'delayed');
videoQueue.clean(0, 'wait');
videoQueue.clean(0, 'active');
videoQueue.clean(0, 'completed');
videoQueue.clean(0, 'failed');

let multi = videoQueue.multi();
multi.del(videoQueue.toKey('repeat'));
multi.exec();
// ---------------------------------------------------------------



function resolutionHigherThan(source, target) {
    // required format: 1920x1080
    const [sourceWidth, sourceHeight] = source.split('x').map(number => Number(number));
    const [targetWidth, targetHeight] = target.split('x').map(number => Number(number));
    
    return (sourceWidth >= targetWidth && sourceHeight >= targetHeight)
}

function getFilenameAndExt(path) {
    const fullFilename = Path.basename(path);
    const lastDotIndex = fullFilename.lastIndexOf('.');
    const filename = fullFilename.substring(0, lastDotIndex);
    const ext = fullFilename.substring(lastDotIndex + 1);
    return [filename, ext];
}

const videoFolder = Path.join(__dirname, '../storage/videos');

function transcodeVideo(job) {
    const videoFilePath = job.data.videoFilePath;
    const resolution = job.data.resolution;
    const [fileName, ext] = getFilenameAndExt(videoFilePath);
    return new Promise((resolve, reject) => {

        const trancodedResolutions = {};
        const command = ffmpeg(videoFilePath);
    
        if(resolutionHigherThan(resolution, '1920x1080')){
            const outputPath = `${videoFolder}/${fileName}-1080p.mp4`;
            trancodedResolutions['1080'] = outputPath;
            command    
                .output(outputPath)
                .videoBitrate(2000)
                .audioBitrate(128)
                .outputFPS(30)
                .format('mp4')
                .size('1920x1080')
                .videoCodec('libx264')
                // .outputOptions('-movflags frag_keyframe+empty_moov')
        }

        if (resolutionHigherThan(resolution, '1280x720')) {
            const outputPath = `${videoFolder}/${fileName}-720p.mp4`;
            trancodedResolutions['720'] = outputPath;
            command
                .output(outputPath)
                .videoBitrate(1000)
                .audioBitrate(128)
                .outputFPS(30)
                .format('mp4')
                .size('1280x720')
                .videoCodec('libx264')
                // .outputOptions('-movflags frag_keyframe+empty_moov')
        }

        if (resolutionHigherThan(resolution, '960x540')) {
            const outputPath = `${videoFolder}/${fileName}-540p.mp4`;
            trancodedResolutions['540'] = outputPath;
            command    
                .output(outputPath)
                .videoBitrate(700)
                .outputFPS(30)
                .audioBitrate(96)
                .format('mp4')
                .size('960x540')
                .videoCodec('libx264')
                // .outputOptions('-movflags frag_keyframe+empty_moov')
        }

        if (resolutionHigherThan(resolution, '640x360')) {
            const outputPath = `${videoFolder}/${fileName}-360p.mp4`;
            trancodedResolutions['360'] = outputPath;
            command
                .output(outputPath)
                .videoBitrate(400)
                .outputFPS(30)
                .audioBitrate(64)
                .format('mp4')
                .size('640x360')
                .videoCodec('libx264')
                // .outputOptions('-movflags frag_keyframe+empty_moov')
        }
        
        command
            .on('start', (commandLine) => {
                // console.log('Spawned Ffmpeg with command: ' + commandLine);
                // console.log(`Job id: ${job.id}`);
                // console.log(`document id: ${job.data.docId}`);
            })
            .on('progress', function(progress) {
                job.progress(+progress.percent);
                // console.log(+progress.percent);
                // console.log(+Math.round(progress.percent));
            })
            .on('end', function(stdout, stderr) {
                console.log('Transcoding succeeded !');
                resolve(trancodedResolutions);
            })
            .on('error', (err) => {
                reject(err);
            })
            .run();
    });
}

videoQueue.process((job) => {
    return transcodeVideo(job);
});

videoQueue.on('active', async function(job, jobPromise) {
    await setVideoToProcessing(job.id);
});

videoQueue.on('waiting', async function(jobId){
    // A Job is waiting to be processed as soon as a worker is idling.
    await setVideoToWaiting(jobId);
});

videoQueue.on('failed', async function(job, err) {
    console.log(err);
    await setVideoToFailed(job.id);
    job.remove();
});

videoQueue.on('progress', function(job, progress) {
    console.log(`PROGRESS: ${progress}`);
});

videoQueue.on('completed', async function(job, result) {
    await videoTranscodingCompleted(job.id, result);
    job.remove();
});

module.exports = videoQueue;
