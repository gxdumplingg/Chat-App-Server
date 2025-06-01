const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const cloudinary = require('cloudinary').v2;

// Send message
exports.sendMessage = async (req, res) => {
    try {
        const { conversationId, text, messageType = "text" } = req.body;
        const senderId = req.user._id;

        console.log('Creating new message with data:', {
            conversationId,
            senderId,
            text,
            messageType
        });

        if (!conversationId || !text) {
            return res.status(400).json({ message: "Conversation ID and text are required" });
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" });
        }

        console.log('Found conversation:', conversation);

        const message = new Message({
            conversationId,
            senderId,
            text,
            messageType
        });

        console.log('Saving message to database...');
        const savedMessage = await message.save();
        console.log('Message saved successfully:', savedMessage);

        conversation.lastMessage = savedMessage._id;
        conversation.updatedAt = new Date();
        console.log('Updating conversation with new message...');
        await conversation.save();
        console.log('Conversation updated successfully');

        // Populate dữ liệu cần thiết để gửi lại
        const populatedConversation = await Conversation.findById(conversationId)
            .populate("participants", "username avatar status lastSeen")
            .populate("lastMessage");

        // Emit đến tất cả client trong phòng
        req.app.get('io').to(conversationId).emit("receiveMessage", {
            message: savedMessage,
            conversation: populatedConversation,
        });

        // Emit conversation update đến từng participant
        populatedConversation.participants.forEach(participant => {
            req.app.get('io').to(participant._id.toString()).emit("conversationUpdated", populatedConversation);
        });

        res.status(201).json(savedMessage);
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