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
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    lastMessage: {
        type: Schema.Types.ObjectId,
        ref: 'Message'
    },
    unreadCount: {
        type: Map,
        of: Number,
        default: {}
    }
}, {
    timestamps: true
});

// Index để tìm kiếm nhanh
conversationSchema.index({ participants: 1 });
conversationSchema.index({ type: 1, participants: 1 });

module.exports = mongoose.model('Conversation', conversationSchema); 