const express = require("express");
const mongoose = require("mongoose");
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();
const Message = require("../models/Message");
const User = require("../models/User");

// Áp dụng middleware xác thực cho tất cả các routes
router.use(authMiddleware);

// Lấy thông tin user theo ID
router.get("/:userId", async (req, res) => {
    try {
        const userId = req.params.userId;
        const user = await User.findById(userId).select("-password");

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// API hiển thị danh sách người dùng đã trò chuyện với userId
router.get("/chat/users/:userId", async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.params.userId);

        console.log("Fetching chat users for:", userId);

        // Lấy danh sách conversationId mà user đã tham gia
        const messages = await Message.find({
            $or: [{ senderId: userId }, { receiverId: userId }]
        }).select("senderId receiverId");

        console.log("Messages found:", messages);

        // Tạo danh sách userId đã từng trò chuyện
        const userIds = new Set();
        messages.forEach(message => {
            if (message.senderId.toString() !== userId.toString()) {
                userIds.add(message.senderId.toString());
            }
            if (message.receiverId.toString() !== userId.toString()) {
                userIds.add(message.receiverId.toString());
            }
        });

        // Tìm thông tin người dùng dựa trên userIds
        const users = await User.find({ _id: { $in: Array.from(userIds) } })
            .select("_id name email avatar");

        console.log("Chat users:", users);

        res.status(200).json({
            success: true,
            users
        });

    } catch (error) {
        console.log("Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

module.exports = router;
