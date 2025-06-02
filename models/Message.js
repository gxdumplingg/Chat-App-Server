const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const reactionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  emoji: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const attachmentSchema = new Schema({
  url: { type: String, required: true },
  type: { type: String, enum: ['image', 'video', 'audio', 'file'], required: true },
  thumbnailUrl: { type: String },
  name: { type: String },
  size: { type: Number }
});
const messageSchema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    text: { type: String, default: '' },
    messageType: {
      type: String,
      enum: ['text', 'image', 'video', 'audio', 'file', 'emoji'],
      default: 'text'
    },
    attachments: [attachmentSchema],
    status: {
      type: Map,
      of: String,
      default: {}
    },
    reactions: [reactionSchema],
    emojiData: {
      emoji: { type: String },
      skinTone: { type: String },
      isCustomEmoji: { type: Boolean, default: false }
    }
  },
  { timestamps: true }
);

// Index để tối ưu tìm kiếm
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);