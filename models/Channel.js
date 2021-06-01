const mongoose = require('mongoose');

const ChannelSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        minlength: 5
    },
    owner: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'User'
    },
    avatar: {
        type: String,
        default: 'default-channel-avatar.png'
    },
    description: {
        type: String,
        required: [true, 'Channel description is required']
    },
    videos: [{
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'Video'
    }],
    subscribers: [{
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'User'
    }],
    numberOfSubscribers: {
        type: Number,
        default: 0
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true,
    id: false
});

ChannelSchema.pre('save' , function(next) {
    if(!this.isModified('subscribers')) return next();

    // whenever subscribers array is modified, we update the numberOfSubscribers

    this.numberOfSubscribers = this.subscribers.length;

    next();
});

ChannelSchema.method('pushSubscriber', function(userId) {
    // whenever someone subscribes, we add the id of the user to this array
    const index = this.subscribers.indexOf(userId); 
    if (index === -1) {
        this.subscribers.push(userId);
    }
});


ChannelSchema.method('removeSubscriber', function(userId) {
    // whenever someone unsubscribes, we remove the id of the user to this array
    const index = this.subscribers.indexOf(userId); 
    if (index > -1) {
        this.subscribers.splice(index, 1);
    }
});

const Channel = mongoose.model('Channel', ChannelSchema);

module.exports = Channel;
