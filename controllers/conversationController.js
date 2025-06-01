const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

// Lấy danh sách cuộc trò chuyện của người dùng
exports.getConversations = async (req, res) => {
    try {
        const conversations = await Conversation.find({
            participants: req.user._id
        })
            .populate('participants', 'username avatar status lastSeen email')
            .populate('lastMessage')
            .sort({ updatedAt: -1 });

        res.json(conversations);
    } catch (error) {
        console.error('Error getting conversations:', error);
        res.status(500).json({ message: error.message });
    }
};

// Tạo cuộc trò chuyện mới
exports.createConversation = async (req, res) => {
    try {
        const { participants, type = 'group' } = req.body;
        const userId = req.user._id;

        // Kiểm tra participants
        if (!participants || !Array.isArray(participants) || participants.length === 0) {
            return res.status(400).json({ message: 'Participants are required' });
        }

        // Thêm người dùng hiện tại vào participants nếu chưa có
        if (!participants.includes(userId.toString())) {
            participants.push(userId.toString());
        }

        // Tạo conversation mới
        const conversation = new Conversation({
            participants,
            type,
            createdBy: userId
        });

        await conversation.save();

        // Populate thông tin người tham gia
        const populatedConversation = await Conversation.findById(conversation._id)
            .populate('participants', 'username avatar status lastSeen email');

        res.status(201).json(populatedConversation);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Cập nhật thông tin cuộc trò chuyện
exports.updateConversation = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, avatar } = req.body;

        const conversation = await Conversation.findById(id);

        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        if (name) conversation.name = name;
        if (avatar) conversation.avatar = avatar;

        await conversation.save();

        res.json(conversation);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Xóa cuộc trò chuyện
exports.deleteConversation = async (req, res) => {
    try {
        const conversation = await Conversation.findById(req.params.id);
        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        // Gửi thông báo đến tất cả participants
        conversation.participants.forEach(participant => {
            io.to(participant.toString()).emit('conversationDeleted', conversation._id);
        });

        await conversation.remove();
        res.json({ message: 'Conversation deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Thêm thành viên vào cuộc trò chuyện
exports.addParticipant = async (req, res) => {
    try {
        const { userId } = req.body;
        const conversation = await Conversation.findByIdAndUpdate(
            req.params.id,
            { $addToSet: { participants: userId } },
            { new: true }
        )
            .populate('participants', 'username avatar status lastSeen')
            .populate('lastMessage');

        // Gửi thông báo đến tất cả participants
        conversation.participants.forEach(participant => {
            io.to(participant._id.toString()).emit('conversationUpdated', conversation);
        });

        res.json(conversation);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Xóa thành viên khỏi cuộc trò chuyện
exports.removeParticipant = async (req, res) => {
    try {
        const conversation = await Conversation.findByIdAndUpdate(
            req.params.id,
            { $pull: { participants: req.params.userId } },
            { new: true }
        )
            .populate('participants', 'username avatar status lastSeen')
            .populate('lastMessage');

        // Gửi thông báo đến tất cả participants
        conversation.participants.forEach(participant => {
            io.to(participant._id.toString()).emit('conversationUpdated', conversation);
        });

        // Gửi thông báo đến user bị xóa
        io.to(req.params.userId).emit('removedFromConversation', conversation._id);

        res.json(conversation);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Rời khỏi cuộc trò chuyện
exports.leaveConversation = async (req, res) => {
    try {
        const { userId } = req.body;
        const conversation = await Conversation.findById(req.params.id);

        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        if (!conversation.participants.includes(userId)) {
            return res.status(400).json({ message: 'User is not in this conversation' });
        }

        // Xóa user khỏi participants
        conversation.participants = conversation.participants.filter(p => p.toString() !== userId);

        // Nếu là conversation 1-1 hoặc không còn ai trong conversation
        if (conversation.type === 'private' || conversation.participants.length === 0) {
            await conversation.remove();
            // Gửi thông báo xóa conversation
            io.to(userId).emit('conversationDeleted', conversation._id);
            return res.json({ message: 'Conversation deleted' });
        }

        // Tạo tin nhắn hệ thống
        const systemMessage = new Message({
            conversationId: conversation._id,
            senderId: userId,
            text: `${userId} has left the group`,
            messageType: 'system'
        });
        await systemMessage.save();

        // Cập nhật lastMessage
        conversation.lastMessage = systemMessage._id;
        conversation.updatedAt = new Date();
        await conversation.save();

        // Gửi thông báo đến tất cả participants còn lại
        conversation.participants.forEach(participant => {
            io.to(participant.toString()).emit('conversationUpdated', conversation);
            io.to(participant.toString()).emit('receiveMessage', {
                message: systemMessage,
                conversation: conversation
            });
        });

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