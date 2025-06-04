const express = require("express");
const mongoose = require("mongoose");
const authMiddleware = require('../middlewares/auth');
const messageController = require('../controllers/messageController');

const Message = require("../models/Message");
const User = require("../models/User");
const Conversation = require("../models/Conversation");

module.exports = (io) => {
    const router = express.Router();

    // Áp dụng middleware xác thực cho tất cả các routes
    router.use(authMiddleware);

    // Gửi tin nhắn
    router.post("/", messageController.sendMessage);

    // Lấy tin nhắn
    router.get("/:conversationId", messageController.getMessages);

    // Đánh dấu tin nhắn đã đọc
    router.put('/:id/read', messageController.markMessageAsRead);

    // React to message with emoji
    router.put('/:messageId/react', messageController.reactToMessage);

    return router;
};