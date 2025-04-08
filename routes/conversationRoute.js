const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationController');
const authMiddleware = require('../middlewares/authMiddleware');

// Logging middleware
router.use((req, res, next) => {
    console.log(`Conversation route: ${req.method} ${req.url}`);
    next();
});

// Áp dụng middleware xác thực cho tất cả các routes
router.use(authMiddleware);

// Lấy danh sách cuộc trò chuyện
router.get('/', (req, res, next) => {
    console.log('GET /conversations route hit');
    conversationController.getConversations(req, res, next);
});

// Tạo cuộc trò chuyện mới
router.post('/', conversationController.createConversation);

// Cập nhật thông tin cuộc trò chuyện
router.put('/:conversationId', conversationController.updateConversation);

// Đánh dấu tin nhắn đã đọc
router.post('/:conversationId/read', conversationController.markAsRead);

module.exports = router; 