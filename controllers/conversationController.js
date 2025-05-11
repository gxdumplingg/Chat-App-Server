const Conversation = require('../models/Conversation');

// Lấy danh sách cuộc trò chuyện của người dùng
exports.getConversations = async (req, res) => {
    try {
        const userId = req.user._id;
        console.log('Getting conversations for user:', userId);

        const conversations = await Conversation.find({
            participants: userId
        })
            .populate('participants', 'username avatar status lastSeen email')
            .populate('lastMessage')
            .sort({ updatedAt: -1 });

        console.log('Found conversations:', conversations);
        res.json(conversations);
    } catch (error) {
        console.error('Error getting conversations:', error);
        res.status(500).json({ message: error.message });
    }
};

// Tạo cuộc trò chuyện mới
exports.createConversation = async (req, res) => {
    try {
        console.log('Creating conversation...');
        console.log('Request body:', req.body);
        console.log('User:', req.user);

        const { participants, type = 'group' } = req.body;
        const userId = req.user._id;

        // Kiểm tra participants
        if (!participants || !Array.isArray(participants) || participants.length === 0) {
            console.log('Invalid participants');
            return res.status(400).json({ message: 'Participants are required' });
        }

        // Thêm người dùng hiện tại vào participants nếu chưa có
        if (!participants.includes(userId.toString())) {
            participants.push(userId.toString());
        }

        // Kiểm tra xem conversation đã tồn tại chưa (cho private chat)
        if (type === 'private' && participants.length === 2) {
            const existingConversation = await Conversation.findOne({
                type: 'private',
                participants: { $all: participants }
            });

            if (existingConversation) {
                return res.json(existingConversation);
            }
        }

        // Tạo conversation mới
        const conversation = new Conversation({
            participants,
            type,
            createdBy: userId
        });

        console.log('Saving conversation...');
        await conversation.save();
        console.log('Created conversation:', conversation);

        // Populate thông tin người tham gia
        const populatedConversation = await Conversation.findById(conversation._id)
            .populate('participants', 'username avatar status lastSeen email');

        console.log('Sending response...');
        return res.status(201).json(populatedConversation);
    } catch (error) {
        console.error('Error creating conversation:', error);
        throw error;
    }
};

// Cập nhật thông tin cuộc trò chuyện
exports.updateConversation = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { name, avatar } = req.body;

        const conversation = await Conversation.findById(conversationId);

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