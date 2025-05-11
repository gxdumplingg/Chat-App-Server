const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationController');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

module.exports = (io) => {
    // Tạo conversation mới
    router.post('/', async (req, res) => {
        console.log('POST /conversations - Request received');
        console.log('Request body:', req.body);
        console.log('User:', req.user);

        try {
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
            res.status(201).json(populatedConversation);
            console.log('Response sent');
        } catch (error) {
            console.error('Error in conversation route:', error);
            res.status(500).json({
                message: 'Internal server error',
                error: error.message,
                stack: error.stack
            });
            console.log('Error response sent');
        }
    });

    // Lấy tất cả conversations của user
    router.get('/', async (req, res) => {
        console.log('GET /conversations - Request received');
        try {
            const conversations = await Conversation.find({
                participants: req.user._id
            })
                .populate('participants', 'username avatar status lastSeen email')
                .populate('lastMessage')
                .sort({ updatedAt: -1 });

            console.log('Found conversations:', conversations);
            res.json(conversations);
            console.log('Response sent');
        } catch (error) {
            console.error('Error in conversation route:', error);
            res.status(500).json({
                message: 'Internal server error',
                error: error.message
            });
            console.log('Error response sent');
        }
    });

    // Cập nhật conversation
    router.put('/:id', async (req, res) => {
        console.log('PUT /conversations/:id - Request received');
        try {
            await conversationController.updateConversation(req, res);
        } catch (error) {
            console.error('Error in conversation route:', error);
            res.status(500).json({
                message: 'Internal server error',
                error: error.message
            });
        }
    });

    // Xóa conversation
    router.delete('/:id', async (req, res) => {
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
    });

    // Thêm thành viên vào conversation
    router.post('/:id/participants', async (req, res) => {
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
    });

    // Xóa thành viên khỏi conversation
    router.delete('/:id/participants/:userId', async (req, res) => {
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
    });

    // Rời khỏi conversation
    router.post('/:id/leave', async (req, res) => {
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
    });

    return router;
}; 