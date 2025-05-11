const mongoose = require('mongoose');

const friendSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending'
    }
}, {
    timestamps: true
});

// Index để tìm kiếm nhanh
friendSchema.index({ sender: 1, receiver: 1 }, { unique: true });

module.exports = mongoose.model('Friend', friendSchema); 