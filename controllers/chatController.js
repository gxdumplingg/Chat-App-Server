const Chat = require("../models/Chat");
const User = require("../models/User");

// API lấy danh sách cuộc hội thoại của một user
const getConversations = async (req, res) => {
    try {
        const userId = req.params.userId; // Lấy userId từ request params

        // Tìm tất cả tin nhắn liên quan đến user này
        const messages = await Chat.find({
            $or: [{ sender_id: userId }, { receiver_id: userId }]
        })
            .sort({ createdAt: -1 }) // Sắp xếp theo thời gian mới nhất trước
            .populate("sender_id", "name email image") // Lấy thông tin người gửi
            .populate("receiver_id", "name email image"); // Lấy thông tin người nhận

        // Dùng Map để nhóm tin nhắn theo cặp user
        const conversations = new Map();

        messages.forEach((msg) => {
            const otherUserId = msg.sender_id._id.toString() === userId
                ? msg.receiver_id._id.toString()
                : msg.sender_id._id.toString();

            if (!conversations.has(otherUserId)) {
                conversations.set(otherUserId, {
                    _id: msg._id,
                    user: msg.sender_id._id.toString() === userId ? msg.receiver_id : msg.sender_id,
                    lastMessage: msg.message,
                    timestamp: msg.createdAt
                });
            }
        });

        res.status(200).json(Array.from(conversations.values()));
    } catch (error) {
        res.status(500).json({ error: "Lỗi khi lấy danh sách hội thoại", details: error.message });
    }
};

module.exports = { getConversations };
