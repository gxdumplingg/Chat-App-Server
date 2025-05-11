const express = require("express");
const mongoose = require("mongoose");
const auth = require('../middlewares/auth');
const Friend = require('../models/Friend');
const multer = require('multer');
const path = require('path');
const { cloudinary, upload } = require('../config/cloudinary');
const userController = require('../controllers/userController');

const router = express.Router();
const Message = require("../models/Message");
const User = require("../models/User");

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../temp'));
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const uploadMiddleware = multer({
    storage: storage,
    limits: {
        fileSize: 2 * 1024 * 1024 // 2MB limit for avatars
    },
    fileFilter: (req, file, cb) => {
        // Accept only images
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only images are allowed for avatars.'));
        }
    }
});

// Search users
router.get('/search', auth, async (req, res) => {
    try {
        const { query } = req.query;
        const users = await User.find({
            $or: [
                { username: { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } }
            ],
            _id: { $ne: req.user._id } // Loại bỏ user hiện tại
        })
            .select('username email avatar status lastSeen')
            .limit(10);

        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get user's friends
router.get('/friends', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate('friends', 'username email avatar status lastSeen');

        res.json(user.friends || []);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Add friend
router.post('/friends', auth, async (req, res) => {
    try {
        const { friendId } = req.body;

        // Kiểm tra friendId có tồn tại
        const friend = await User.findById(friendId);
        if (!friend) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Kiểm tra đã là bạn chưa
        const user = await User.findById(req.user._id);
        if (user.friends.includes(friendId)) {
            return res.status(400).json({ message: 'Already friends' });
        }

        // Thêm bạn
        user.friends.push(friendId);
        friend.friends.push(req.user._id);

        await user.save();
        await friend.save();

        // Gửi thông báo realtime
        const io = req.app.get('io');
        io.to(friendId.toString()).emit('newFriend', {
            friend: {
                _id: req.user._id,
                username: req.user.username,
                email: req.user.email,
                avatar: req.user.avatar
            }
        });

        res.json({ message: 'Friend added successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Remove friend
router.delete('/friends/:friendId', auth, async (req, res) => {
    try {
        const { friendId } = req.params;

        // Kiểm tra friendId có tồn tại
        const friend = await User.findById(friendId);
        if (!friend) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Xóa bạn
        const user = await User.findById(req.user._id);
        user.friends = user.friends.filter(id => id.toString() !== friendId);
        friend.friends = friend.friends.filter(id => id.toString() !== req.user._id);

        await user.save();
        await friend.save();

        // Gửi thông báo realtime
        const io = req.app.get('io');
        io.to(friendId.toString()).emit('friendRemoved', {
            friendId: req.user._id
        });

        res.json({ message: 'Friend removed successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update user avatar
router.put('/avatar', auth, uploadMiddleware.single('avatar'), userController.updateAvatar);

// Update user status
router.put('/status', auth, async (req, res) => {
    try {
        const { status } = req.body;

        if (!['online', 'offline'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const user = await User.findByIdAndUpdate(
            req.user._id,
            {
                status,
                lastSeen: new Date()
            },
            { new: true }
        ).select('-password');

        // Gửi thông báo realtime
        const io = req.app.get('io');
        user.friends.forEach(friendId => {
            io.to(friendId.toString()).emit('userStatusChanged', {
                userId: user._id,
                status: user.status,
                lastSeen: user.lastSeen
            });
        });

        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Lấy thông tin user theo ID
router.get("/:userId", auth, async (req, res) => {
    try {
        const userId = req.params.userId;
        const user = await User.findById(userId)
            .select("-password")
            .populate('friends', 'username email avatar status lastSeen');

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// API hiển thị danh sách người dùng đã trò chuyện với userId
router.get("/chat/users/:userId", auth, async (req, res) => {
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

// Send friend request
router.post('/friend-request', auth, async (req, res) => {
    try {
        const { senderId, receiverId } = req.body;

        // Kiểm tra đã gửi request chưa
        const existingRequest = await Friend.findOne({
            $or: [
                { sender: senderId, receiver: receiverId },
                { sender: receiverId, receiver: senderId }
            ]
        });

        if (existingRequest) {
            return res.status(400).json({ message: 'Friend request already exists' });
        }

        // Tạo friend request mới
        const friendRequest = new FriendRequest({
            sender: senderId,
            receiver: receiverId
        });
        await friendRequest.save();

        // Gửi thông báo realtime
        io.to(receiverId.toString()).emit('newFriendRequest', {
            requestId: friendRequest._id,
            sender: await User.findById(senderId).select('username email avatar')
        });

        res.status(201).json(friendRequest);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Accept friend request
router.put('/friend-request/:id/accept', auth, async (req, res) => {
    try {
        const { userId } = req.body;
        const friendRequest = await Friend.findById(req.params.id);

        if (!friendRequest) {
            return res.status(404).json({ message: 'Friend request not found' });
        }

        if (friendRequest.receiver.toString() !== userId) {
            return res.status(403).json({ message: 'Not authorized to accept this request' });
        }

        // Cập nhật trạng thái
        friendRequest.status = 'accepted';
        await friendRequest.save();

        // Gửi thông báo realtime
        io.to(friendRequest.sender.toString()).emit('friendRequestAccepted', {
            requestId: friendRequest._id,
            receiver: await User.findById(userId).select('username email avatar')
        });

        res.json(friendRequest);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get friend requests
router.get('/friend-requests/:userId', auth, async (req, res) => {
    try {
        const friendRequests = await Friend.find({
            receiver: req.params.userId,
            status: 'pending'
        }).populate('sender', 'username email avatar');

        res.json(friendRequests);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
