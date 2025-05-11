const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const cloudinary = require('cloudinary').v2;

// Send message
exports.sendMessage = async (req, res) => {
    try {
        const { conversationId, text, media, emoji } = req.body;
        const senderId = req.user._id;

        // Validate conversation exists and user is a participant
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.participants.includes(senderId)) {
            return res.status(403).json({ message: 'Not authorized to send message in this conversation' });
        }

        // Create message object
        const messageData = {
            conversationId,
            senderId,
            text: text || '',
            emoji: emoji || null
        };

        // Add media if provided
        if (media) {
            messageData.media = {
                url: media.url,
                publicId: media.publicId,
                type: media.type
            };
        }

        const message = new Message(messageData);
        await message.save();

        // Populate sender info
        await message.populate('senderId', 'username avatar');

        // Emit socket event
        req.app.get('io').to(conversationId).emit('receiveMessage', {
            message: {
                ...message.toObject(),
                sender: message.senderId
            }
        });

        res.status(201).json(message);
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ message: 'Error sending message' });
    }
};

// Get messages for a conversation
exports.getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user._id;
        const { page = 1, limit = 50 } = req.query;

        // Validate conversation exists and user is a participant
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.participants.includes(userId)) {
            return res.status(403).json({ message: 'Not authorized to view messages in this conversation' });
        }

        const messages = await Message.find({ conversationId })
            .populate('senderId', 'username avatar')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        // Get total count for pagination
        const total = await Message.countDocuments({ conversationId });

        res.json({
            messages: messages.reverse(),
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ message: 'Error getting messages' });
    }
};

// Delete message
exports.deleteMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user._id;

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        // Only allow sender to delete message
        if (message.senderId.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Not authorized to delete this message' });
        }

        // Delete media from Cloudinary if exists
        if (message.media && message.media.publicId) {
            await cloudinary.uploader.destroy(message.media.publicId);
        }

        await message.remove();

        // Emit socket event
        req.app.get('io').to(message.conversationId).emit('messageDeleted', {
            messageId: message._id,
            conversationId: message.conversationId
        });

        res.json({ message: 'Message deleted successfully' });
    } catch (error) {
        console.error('Delete message error:', error);
        res.status(500).json({ message: 'Error deleting message' });
    }
};

// React to message with emoji
exports.reactToMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { emoji } = req.body;
        const userId = req.user._id;

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        // Add or update reaction
        const reactionIndex = message.reactions.findIndex(
            r => r.userId.toString() === userId.toString()
        );

        if (reactionIndex > -1) {
            // Update existing reaction
            message.reactions[reactionIndex].emoji = emoji;
        } else {
            // Add new reaction
            message.reactions.push({ userId, emoji });
        }

        await message.save();

        // Emit socket event
        req.app.get('io').to(message.conversationId).emit('messageReaction', {
            messageId: message._id,
            reaction: {
                userId,
                emoji
            }
        });

        res.json(message);
    } catch (error) {
        console.error('React to message error:', error);
        res.status(500).json({ message: 'Error reacting to message' });
    }
}; 