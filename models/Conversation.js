const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const conversationSchema = new Schema({
    participants: [{
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }],
    type: {
        type: String,
        enum: ['private', 'group'],
        default: 'private'
    },
    groupName: {
        type: String
    },
    groupAvatar: {
        type: String
    },
    lastMessage: {
        type: Schema.Types.ObjectId,
        ref: 'Message'
    },
    unreadCount: {
        type: Map,
        of: Number,
        default: {}
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Conversation', conversationSchema); 