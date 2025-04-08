const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationController');
const authMiddleware = require('../middlewares/authMiddleware');

// Áp dụng middleware xác thực cho tất cả các routes
router.use(authMiddleware);

// Lấy danh sách cuộc trò chuyện
router.get('/', conversationController.getConversations);

// Tạo cuộc trò chuyện mới
router.post('/', conversationController.createConversation);

// Cập nhật thông tin cuộc trò chuyện
router.put('/:conversationId', conversationController.updateConversation);

// Đánh dấu tin nhắn đã đọc
router.post('/:conversationId/read', conversationController.markAsRead);

module.exports = router; 