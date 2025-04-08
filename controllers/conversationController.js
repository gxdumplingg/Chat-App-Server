const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');

// Lấy danh sách cuộc trò chuyện của người dùng
exports.getConversations = async (req, res) => {
    try {
        const userId = req.user._id;

        const conversations = await Conversation.find({
            participants: userId
        })
            .populate('participants', 'username avatar status lastSeen')
            .populate('lastMessage')
            .sort({ updatedAt: -1 });

        // Format unreadCount cho người dùng hiện tại
        const formattedConversations = conversations.map(conv => {
            const unreadCount = conv.unreadCount.get(userId.toString()) || 0;
            return {
                ...conv.toObject(),
                unreadCount
            };
        });

        res.json(formattedConversations);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Tạo cuộc trò chuyện mới
exports.createConversation = async (req, res) => {
    try {
        const { participants, type, groupName, groupAvatar } = req.body;

        // Kiểm tra xem cuộc trò chuyện đã tồn tại chưa (chỉ cho private chat)
        if (type === 'private') {
            const existingConversation = await Conversation.findOne({
                type: 'private',
                participants: { $all: participants }
            });

            if (existingConversation) {
                return res.json(existingConversation);
            }
        }

        const newConversation = new Conversation({
            participants,
            type,
            groupName,
            groupAvatar
        });

        await newConversation.save();

        const populatedConversation = await Conversation.findById(newConversation._id)
            .populate('participants', 'username avatar status lastSeen');

        res.status(201).json(populatedConversation);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Cập nhật thông tin cuộc trò chuyện
exports.updateConversation = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const updateData = req.body;

        const conversation = await Conversation.findByIdAndUpdate(
            conversationId,
            updateData,
            { new: true }
        )
            .populate('participants', 'username avatar status lastSeen')
            .populate('lastMessage');

        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        res.json(conversation);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Đánh dấu tin nhắn đã đọc
exports.markAsRead = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user._id;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        // Reset unreadCount cho người dùng hiện tại
        conversation.unreadCount.set(userId.toString(), 0);
        await conversation.save();

        res.json({ message: 'Marked as read successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}; 