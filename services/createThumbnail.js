const ffmpeg = require('fluent-ffmpeg');
const Path = require('path');

function getFilenameAndExt(path) {
    const fullFilename = Path.basename(path);
    const lastDotIndex = fullFilename.lastIndexOf('.');
    const filename = fullFilename.substring(0, lastDotIndex);
    const ext = fullFilename.substring(lastDotIndex + 1);
    return [filename, ext];
}

// setting binaries
ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);

const thumbnailFolder = Path.join(__dirname, '../storage/thumbnails');

module.exports = (videoFilePath, videoId) => {
    const [filename, ext] = getFilenameAndExt(videoFilePath);
    return new Promise((resolve, reject) => {
        ffmpeg(videoFilePath)
            .on('start', (commandLine) => {
                console.log('Spawned Ffmpeg with command: ' + commandLine);
            })
            .on('end', function() {
                resolve({ filename: `${filename}-thumbnail.png` });
            })
            .on('error', function(err) {
                reject(err);
            })
            .screenshot({
                filename: `${videoId}-${Date.now()}-thumbnail.png`,
                folder: thumbnailFolder,
                size: '640x360',
                timestamps: [30] // takes 1 screenshot in second 5
            });
    })
}
