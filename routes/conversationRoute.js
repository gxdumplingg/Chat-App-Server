const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

module.exports = (io) => {
    // Tạo conversation mới
    router.post('/', async (req, res) => {
        try {
            const { participants, name, type } = req.body;
            const conversation = new Conversation({
                participants,
                name,
                type
            });
            await conversation.save();

            // Gửi thông báo đến tất cả participants
            participants.forEach(participantId => {
                io.to(participantId.toString()).emit('conversationCreated', conversation);
            });

            res.status(201).json(conversation);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    });

    // Lấy tất cả conversations của user
    router.get('/:userId', async (req, res) => {
        try {
            const conversations = await Conversation.find({
                participants: req.params.userId
            })
                .populate('participants', 'username avatar status lastSeen')
                .populate('lastMessage')
                .sort({ updatedAt: -1 });

            res.json(conversations);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    });

    // Cập nhật conversation
    router.put('/:id', async (req, res) => {
        try {
            const conversation = await Conversation.findByIdAndUpdate(
                req.params.id,
                req.body,
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