const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();
const Message = require("../models/Message");
const User = require("../models/User");

router.get("/message/:userId", async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.params.userId);
        console.log("Requested userId:", userId);

        // Lấy tất cả tin nhắn mà user này gửi
        const messages = await Message.find({
            senderId: userId // Chỉ lấy tin nhắn gửi đi
        })
            .sort({ createdAt: -1 }) // Sắp xếp theo thời gian mới nhất
            .populate("senderId", "name email avatar"); // Lấy thông tin người gửi


        console.log("Messages found:", messages);

        const conversationsMap = new Map();

        messages.forEach(message => {
            const sender = message.senderId;
            if (!sender) {
                console.log("Missing sender data in message:", message);
                return;
            }


            const conversationId = message.conversationId.toString();

            if (!conversationsMap.has(conversationId)) {
                // Chỉ lưu tin nhắn mới nhất cho mỗi cuộc trò chuyện
                conversationsMap.set(conversationId, {
                    user: {
                        _id: sender._id,
                        name: sender.name,
                        email: sender.email,
                        avatar: sender.avatar
                    },
                    lastMessage: message.text,
                    timestamp: message.createdAt
                });
            } else {
                // Cập nhật tin nhắn cuối cùng nếu có tin nhắn mới hơn
                const currentConversation = conversationsMap.get(conversationId);
                if (message.createdAt > currentConversation.timestamp) {
                    currentConversation.lastMessage = message.text;
                    currentConversation.timestamp = message.createdAt;
                }
            }
        });

        const conversations = Array.from(conversationsMap.values());

        res.status(200).json({
            success: true,
            conversations
        });

    } catch (error) {
        console.log("Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

module.exports = router;
