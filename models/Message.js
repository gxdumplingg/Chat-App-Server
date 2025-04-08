const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const messageSchema = new Schema({
    conversationId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    text: { type: String, default: '' },
    messageType: {
        type: String,
        enum: ['text', 'image', 'video', 'audio', 'file'],
        default: 'text'
    },
    attachments: [{ type: String }],
    status: {
        type: Map,
        of: String,
        default: {}
    },
}, { timestamps: true });


module.exports = mongoose.model('Message', messageSchema);