const User = require('../models/User');
const Friend = require('../models/Friend');
const cloudinary = require('cloudinary').v2;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Message = require('../models/Message');


// Search users
exports.searchUsers = async (req, res) => {
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
};

// Get user's friends
exports.getFriends = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate('friends', 'username email avatar status lastSeen');

        res.json(user.friends || []);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Add friend
exports.addFriend = async (req, res) => {
    try {
        const { friendId } = req.body;
        const userId = req.user._id;

        // Kiểm tra friendId có tồn tại
        const friend = await User.findById(friendId);
        if (!friend) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Kiểm tra đã là bạn chưa
        const user = await User.findById(userId);
        if (user.friends.includes(friendId)) {
            return res.status(400).json({ message: 'Already friends' });
        }

        // Kiểm tra đã có friend request chưa
        const existingFriendRequest = await Friend.findOne({
            $or: [
                { sender: userId, receiver: friendId },
                { sender: friendId, receiver: userId }
            ]
        });

        if (existingFriendRequest) {
            return res.status(400).json({ message: 'Friend request already exists' });
        }

        // Tạo friend request mới
        const friendRequest = new Friend({
            sender: userId,
            receiver: friendId,
            status: 'accepted' // Tự động accept friend request
        });

        await friendRequest.save();

        // Thêm bạn vào danh sách friends của cả hai user
        user.friends.push(friendId);
        friend.friends.push(userId);

        await user.save();
        await friend.save();

        // Gửi thông báo realtime
        const io = req.app.get('io');
        io.to(friendId.toString()).emit('newFriend', {
            friend: {
                _id: user._id,
                username: user.username,
                email: user.email,
                avatar: user.avatar
            }
        });

        res.json({
            message: 'Friend added successfully',
            friendRequest
        });
    } catch (error) {
        console.error('Add friend error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Remove friend
exports.removeFriend = async (req, res) => {
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
};

// Update user avatar
exports.updateAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const userId = req.user._id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Delete old avatar from Cloudinary if exists
        if (user.avatar && user.avatar.publicId) {
            await cloudinary.uploader.destroy(user.avatar.publicId);
        }

        // Upload new avatar
        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'chat-app/avatars',
            transformation: [
                { width: 200, height: 200, crop: 'fill' },
                { quality: 'auto' },
                { fetch_format: 'auto' }
            ]
        });

        // Update user avatar
        user.avatar = {
            url: result.secure_url,
            publicId: result.public_id
        };
        await user.save();

        // Emit socket event for avatar update
        req.app.get('io').emit('userAvatarUpdated', {
            userId: user._id,
            avatar: user.avatar
        });

        res.json({
            message: 'Avatar updated successfully',
            avatar: user.avatar
        });
    } catch (error) {
        console.error('Update avatar error:', error);
        res.status(500).json({ message: 'Error updating avatar' });
    }
};

// Update user status
exports.updateStatus = async (req, res) => {
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
};

// Get user by ID
exports.getUserById = async (req, res) => {
    try {
        const { userId } = req.params;
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
};

// Get chat users
exports.getChatUsers = async (req, res) => {
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
};

// Send friend request
exports.sendFriendRequest = async (req, res) => {
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
        const friendRequest = new Friend({
            sender: senderId,
            receiver: receiverId
        });
        await friendRequest.save();

        // Gửi thông báo realtime
        req.app.get('io').to(receiverId.toString()).emit('newFriendRequest', {
            requestId: friendRequest._id,
            sender: await User.findById(senderId).select('username email avatar')
        });

        res.status(201).json(friendRequest);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Accept friend request
exports.acceptFriendRequest = async (req, res) => {
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
        const sender = await User.findById(friendRequest.sender);
        const receiver = await User.findById(friendRequest.receiver);
        if (sender && receiver) {
            if (!sender.friends.includes(receiver._id)) {
                sender.friends.push(receiver._id);
                await sender.save();
            }
            if (!receiver.friends.includes(sender._id)) {
                receiver.friends.push(sender._id);
                await receiver.save();
            }
        }
        // Gửi thông báo realtime
        req.app.get('io').to(friendRequest.sender.toString()).emit('friendRequestAccepted', {
            requestId: friendRequest._id,
            receiver: await User.findById(userId).select('username email avatar')
        });

        res.json(friendRequest);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.rejectFriendRequest = async (req, res) => {
    try {
        const { userId } = req.body;
        const friendRequest = await Friend.findById(req.params.id);
        if (!friendRequest) {
            return res.status(404).json({ message: 'Friend request not found' });
        }
        if (friendRequest.receiver.toString() !== userId) {
            return res.status(403).json({ message: 'Not authorized to reject this request' });
        }
        friendRequest.status = 'rejected';
        await friendRequest.save();
        res.json(friendRequest);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// Get friend requests
exports.getFriendRequests = async (req, res) => {
    try {
        const friendRequests = await Friend.find({
            receiver: req.params.userId,
            status: 'pending'
        }).populate('sender', 'username email avatar');

        res.json(friendRequests);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get all users
exports.getAllUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const skip = (page - 1) * limit;

        // Tạo query để tìm kiếm
        const query = {
            $or: [
                { username: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ],
            _id: { $ne: req.user._id } // Loại bỏ user hiện tại
        };

        // Lấy tổng số users
        const total = await User.countDocuments(query);

        // Lấy danh sách users
        const users = await User.find(query)
            .select('_id username email createdAt avatar status lastSeen')
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        res.json({
            users,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get all users error:', error);
        res.status(500).json({ message: error.message });
    }
};

