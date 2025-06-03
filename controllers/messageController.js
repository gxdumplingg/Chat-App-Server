const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const cloudinary = require('cloudinary').v2;

// Send message
exports.sendMessage = async (req, res) => {
    try {
        const { conversationId, text = '', messageType = 'text', attachments = [], emojiData } = req.body;
        const senderId = req.user._id;

        console.log('Creating new message with data:', {
            conversationId,
            senderId,
            text,
            messageType,
            attachments,
            emojiData
        });

        // Validate
        if (!conversationId) {
            return res.status(400).json({ message: "Conversation ID is required" });
        }

        // Validate message content based on messageType
        if (messageType === 'emoji') {
            if (!emojiData || !emojiData.emoji) {
                return res.status(400).json({ message: "Emoji data is required for emoji messages" });
            }
        } else {
            // For other message types, check text or attachments
            const trimmedText = text.trim();
            if (trimmedText === '' && (!attachments || attachments.length === 0)) {
                return res.status(400).json({ message: "Message must contain text or attachments" });
            }
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" });
        }

        const message = new Message({
            conversationId,
            senderId,
            text: text.trim(),
            messageType,
            attachments,
            emojiData: messageType === 'emoji' ? emojiData : undefined
        });

        const savedMessage = await message.save();

        conversation.lastMessage = savedMessage._id;
        conversation.updatedAt = new Date();
        await conversation.save();

        const populatedConversation = await Conversation.findById(conversationId)
            .populate("participants", "username avatar status lastSeen")
            .populate("lastMessage");

        // Populate sender information
        const populatedMessage = await Message.findById(savedMessage._id)
            .populate("senderId", "username avatar");

        // Socket emit
        req.app.get('io').to(conversationId).emit("receiveMessage", {
            message: populatedMessage,
            conversation: populatedConversation,
        });

        populatedConversation.participants.forEach(participant => {
            req.app.get('io')
                .to(participant._id.toString())
                .emit("conversationUpdated", populatedConversation);
        });

        res.status(201).json(populatedMessage);
    } catch (error) {
        console.error('Error in message creation:', error);
        res.status(500).json({ message: error.message });
    }
};


// Get messages for a conversation
exports.getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user._id;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" });
        }

        if (!conversation.participants.includes(userId)) {
            return res.status(403).json({ message: "You are not a participant of this conversation" });
        }

        const messages = await Message.find({ conversationId })
            .sort({ createdAt: 1 })
            .populate("senderId", "username avatar");

        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: error.message });
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

        console.log('Debug - React to message request:');
        console.log('Message ID:', messageId);
        console.log('User ID:', userId);
        console.log('Emoji:', emoji);

        const message = await Message.findById(messageId);
        console.log('Debug - Found message:', message);

        if (!message) {
            console.log('Debug - Message not found with ID:', messageId);
            return res.status(404).json({ message: 'Message not found' });
        }

        // Add or update reaction
        const reactionIndex = message.reactions.findIndex(
            r => r.userId.toString() === userId.toString()
        );
        console.log('Debug - Reaction index:', reactionIndex);

        if (reactionIndex > -1) {
            // Update existing reaction
            message.reactions[reactionIndex].emoji = emoji;
            console.log('Debug - Updated existing reaction');
        } else {
            // Add new reaction
            message.reactions.push({ userId, emoji });
            console.log('Debug - Added new reaction');
        }

        await message.save();
        console.log('Debug - Saved message with new reaction');

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
        console.error('Error details:', {
            message: error.message,
            stack: error.stack
        });
        res.status(500).json({ message: 'Error reacting to message' });
    }
};

// Mark message as read
exports.markMessageAsRead = async (req, res) => {
    try {
        const { userId } = req.body;
        const message = await Message.findById(req.params.id);

        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        // Cập nhật trạng thái đã đọc
        message.status.set(userId, 'read');
        await message.save();

        // Gửi thông báo cập nhật trạng thái
        req.app.get('io').to(message.conversationId.toString()).emit('messageStatusUpdated', {
            messageId: message._id,
            userId: userId,
            status: 'read'
        });

        res.json({ message: 'Message marked as read' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}; 