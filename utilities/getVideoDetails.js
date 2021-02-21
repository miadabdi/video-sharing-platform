const ffmpeg = require('fluent-ffmpeg');

module.exports = (absolutePath) => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(absolutePath, (err, data) => {
            if(err) return reject(err);
            resolve(data);
        })
    });
};
