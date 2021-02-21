const mongoose = require('mongoose');
const { unlink } = require('fs');
const { promisify } = require('util');
const unlinkPromise = promisify(unlink);

const VideoRefrensing = new mongoose.Schema({
    filename: {
        type: String,
        required: true
    },
    fileSize: Number,
    frameRate: Number,
    resolution: String,
    videoBitrate: String,
    videoCodec: String,
    audioBitrate: String,
    audioCodec: String,
    audioChannels: Number,
    duration: Number,
    overallBitrate: String
});

const VideoSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Title is required'],
        maxlength: 40
    },
    description: {
        type: String,
        maxlength: 2000,
        minlength: 40
    },
    visits: {
        type: Number,
        default: 0
    },
    likes: [{
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'User'
    }],
    numberOfLikes: {
        type: Number,
        default: 0
    },
    dislikes: [{
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'User'
    }],
    numberOfDislikes: {
        type: Number,
        default: 0
    },
    creator: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'Channel'
    },
    status: {
        type: String,
        enum: ['Ready for processing', 'Waiting in queue', 'Processing', 'Failed in processing', 'Ready to publish', 'Published', 'Deleted'],
        default: 'Ready for processing'
    },
    duration: {
        type: Number,
        required: [true, 'duration is required in seconds']
    },
    language: {
        type: String,
        enum: ['English', 'Persian']
    },
    isPublished: {
        type: Boolean,
        default: false
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    thumbnail: {
        type: String,
        required: [true, 'Thumbnail is required']
    },
    availableResolutions: [String],
    orgVideo: VideoRefrensing,
    video360p: VideoRefrensing,
    video540p: VideoRefrensing,
    video720p: VideoRefrensing,
    video1080p: VideoRefrensing
}, {
    timestamps: true,
    id: false
});

VideoSchema.pre('save' , function(next) {
    if(!this.isModified('likes')) return next();

    this.numberOfLikes = this.likes.length;

    next();
})

VideoSchema.pre('save' , function(next) {
    if(!this.isModified('dislikes')) return next();

    this.numberOfDislikes = this.dislikes.length;

    next();
})

VideoSchema.method('removeFromLikes', function(userId) {
    const index = this.likes.indexOf(userId); 
    if (index > -1) {
        this.likes.splice(index, 1);
    }
})

VideoSchema.method('addToLikes', function(userId) {
    const index = this.likes.indexOf(userId); 
    if (index === -1) {
        this.likes.push(userId);
    }
})

VideoSchema.method('removeFromDislikes', function(userId) {
    const index = this.dislikes.indexOf(userId); 
    if (index > -1) {
        this.dislikes.splice(index, 1);
    }
})

VideoSchema.method('addToDislikes', function(userId) {
    const index = this.dislikes.indexOf(userId); 
    if (index === -1) {
        this.dislikes.push(userId);
    }
})

VideoSchema.method('unlinkOrgVideo', async function() { 
    // deleting original video
    if (this.orgVideo) {
        const path = `${process.env.VIDEO_FOLDER}/${this.orgVideo.filename}`;
        await unlinkPromise(path);
        this.set('orgVideo', undefined);
    }
})

VideoSchema.method('unlinkVideos', async function() { 
    // deleting videos
    for (const res of this.availableResolutions) {
        const key = `video${res}p`;
        if (this[key]) {
            const path = `${process.env.VIDEO_FOLDER}/${this[key].filename}`;
            await unlinkPromise(path);
            this.set(key, undefined);
        }
    }
})


const Video = mongoose.model('Video', VideoSchema);

module.exports = Video;
