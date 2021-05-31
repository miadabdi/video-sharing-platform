const mongoose = require('mongoose');
const { rm, existsSync, unlink } = require('fs');
const { promisify } = require('util');
const rmPromise = promisify(rm);
const unlinkPromise = promisify(unlink);
const Path = require('path');
const { RFC5646_LANGUAGE_TAGS } = require('../globals');


const langCodes = Object.keys(RFC5646_LANGUAGE_TAGS);
  

const captionSchema = new mongoose.Schema({
    filename: {
        type: String,
        required: [true, 'caption filename is required']
    },
    languageInRFC5646: {
        type: String,
        enum: langCodes,
        required: [true, 'Language code based on RFC 5646 should be passed']
    }
});

captionSchema.virtual('language').get(function() {
    return RFC5646_LANGUAGE_TAGS[this.languageInRFC5646];
})

const VideoSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Title is required'],
        maxlength: 100
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
    views: {
        type: Number,
        default: 0
    },
    dedicatedDir: String,
    captions: [captionSchema],
    orgVideoFilename: String
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

VideoSchema.method('unlinkThumbnail', async function() { 
    // deleting original video

    const path = Path.join(__dirname, `../storage/thumbnails/${this.thumbnail}`);
    // FIXME: exists should not be used
    if (!existsSync(path)) return;

    await unlinkPromise(path);
    this.set('thumbnail', undefined);
})

VideoSchema.method('unlinkOrgVideo', async function() { 
    // deleting original video

    const path = Path.join(__dirname, `../storage/videos/${this.orgVideoFilename}`);
    // FIXME: exists should not be used
    if (!existsSync(path)) return;

    await unlinkPromise(path);
    this.set('orgVideoFilename', undefined);
})

VideoSchema.method('unlinkVideos', async function() { 
    // deleting videos
    const path = Path.join(__dirname, `../storage/videos/${this.dedicatedDir}`);
    // FIXME: exists should not be used
    if (!existsSync(path)) return;

    await rmPromise(path, 
        { recursive: true, maxRetries: 5, retryDelay: 100 }
    );
    
})


const Video = mongoose.model('Video', VideoSchema);

module.exports = Video;


