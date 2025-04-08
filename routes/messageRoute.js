const express = require("express");
const mongoose = require("mongoose");
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();
const Message = require("../models/Message");
const User = require("../models/User");
const Conversation = require("../models/Conversation");

// Áp dụng middleware xác thực cho tất cả các routes
router.use(authMiddleware);

// Gửi tin nhắn
router.post("/", async (req, res) => {
    try {
        const { conversationId, text, messageType = "text" } = req.body;
        const senderId = req.user._id;

        if (!conversationId || !text) {
            return res.status(400).json({ message: "Conversation ID and text are required" });
        }

        // Kiểm tra conversation có tồn tại không
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" });
        }

        // Tạo tin nhắn mới
        const message = new Message({
            conversationId,
            senderId,
            text,
            messageType
        });

        await message.save();

        // Cập nhật lastMessage và updatedAt của conversation
        conversation.lastMessage = message._id;
        conversation.updatedAt = new Date();
        await conversation.save();

        res.status(201).json(message);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Lấy tin nhắn trong conversation
router.get("/:conversationId", async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user._id;

        // Kiểm tra conversation có tồn tại không
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" });
        }

        // Kiểm tra user có trong conversation không
        if (!conversation.participants.includes(userId)) {
            return res.status(403).json({ message: "You are not a participant of this conversation" });
        }

        // Lấy tin nhắn
        const messages = await Message.find({ conversationId })
            .sort({ createdAt: 1 })
            .populate("senderId", "username avatar");

        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
