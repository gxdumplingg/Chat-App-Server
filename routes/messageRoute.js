const express = require("express");
const mongoose = require("mongoose");
const authMiddleware = require('../middlewares/authMiddleware');

const Message = require("../models/Message");
const User = require("../models/User");
const Conversation = require("../models/Conversation");

module.exports = (io) => {
    const router = express.Router();

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

            const conversation = await Conversation.findById(conversationId);
            if (!conversation) {
                return res.status(404).json({ message: "Conversation not found" });
            }

            const message = new Message({
                conversationId,
                senderId,
                text,
                messageType
            });

            await message.save();

            conversation.lastMessage = message._id;
            conversation.updatedAt = new Date();
            await conversation.save();

            // Populate dữ liệu cần thiết để gửi lại
            const populatedConversation = await Conversation.findById(conversationId)
                .populate("participants", "username avatar status lastSeen")
                .populate("lastMessage");

            // Emit đến tất cả client trong phòng
            io.to(conversationId).emit("receiveMessage", {
                message,
                conversation: populatedConversation,
            });

            // Emit conversation update đến từng participant
            populatedConversation.participants.forEach(participant => {
                io.to(participant._id.toString()).emit("conversationUpdated", populatedConversation);
            });

            res.status(201).json(message);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    });

    // Lấy tin nhắn
    router.get("/:conversationId", async (req, res) => {
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
    });

    return router;
};
