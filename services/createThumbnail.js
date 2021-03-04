const ffmpeg = require('fluent-ffmpeg');
const Path = require('path');

function getFilenameAndExt(path) {
    const fullFilename = Path.basename(path);
    const lastDotIndex = fullFilename.lastIndexOf('.');
    const filename = fullFilename.substring(0, lastDotIndex);
    const ext = fullFilename.substring(lastDotIndex + 1);
    return [filename, ext];
}

const folderPath = process.env.VIDEO_FOLDER;

module.exports = (videoFilePath, videoId) => {
    const [filename, ext] = getFilenameAndExt(videoFilePath);
    return new Promise((resolve, reject) => {
        ffmpeg(videoFilePath)
            .on('end', function() {
                resolve({ filename: `${filename}-thumbnail.png` });
            })
            .on('error', function(err) {
                reject(err);
            })
            .screenshot({
                filename: `${videoId}-thumbnail.png`,
                folder: `${folderPath}/thumbnails`,
                size: '640x360',
                timestamps: [5] // takes 1 screenshot in second 5
            });
    })
}
