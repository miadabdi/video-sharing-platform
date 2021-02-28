const mongoose = require('mongoose');

const ReplySchema = new mongoose.Schema({
    author: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'Comment',
        required: [true, 'Author is required']
    },
    content: {
        type: String,
        required: [true, 'Content is required']
    },
    isEdited: {
        type: Boolean,
        default: false
    },
    replyTo: {
        user: {
            type: mongoose.SchemaTypes.ObjectId,
            ref: 'User',
            required: [true, 'User\'s ID is required']
        },
        fullname: {
            type: String,
            required: [true, 'User\'s name is required']
        }
    }
},
{
    timestamps: true,
    id: false
});

const CommentSchema = new mongoose.Schema({
    author: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'User',
        required: [true, 'Author is required']
    },
    video: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'Video',
        required: [true, 'Video ID is required']
    },
    content: {
        type: String,
        required: [true, 'Content is required']
    },
    isEdited: {
        type: Boolean,
        default: false
    },
    replies: [ReplySchema]
},
{
    timestamps: true,
    id: false
});

const Comment = mongoose.model('Comment', CommentSchema);

module.exports = Comment;
