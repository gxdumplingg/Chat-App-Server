const User = require('../models/User');
const cloudinary = require('cloudinary').v2;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.registerLoad = async (req, res) => {
    try {
        res.status(200).json({ message: "Register endpoint is working" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.register = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Validate input
        if (!username || !email || !password) {
            return res.status(400).json({ message: 'Please provide all required fields' });
        }

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [{ email }, { username }]
        });

        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new user
        const user = new User({
            username,
            email,
            password: hashedPassword,
            status: 'offline'
        });

        await user.save();

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'Registration successful',
            token,
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                avatar: user.avatar
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Error registering user' });
    }
};

// Login user
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Update status to online
        user.status = 'online';
        await user.save();

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                avatar: user.avatar,
                status: user.status
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Error logging in' });
    }
};

// Search users
exports.searchUsers = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.status(400).json({ message: 'Search query is required' });
        }

        const users = await User.find({
            $or: [
                { username: { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } }
            ],
            _id: { $ne: req.user._id } // Exclude current user
        }).select('-password');

        res.json(users);
    } catch (error) {
        console.error('Search users error:', error);
        res.status(500).json({ message: 'Error searching users' });
    }
};

// Get user's friends
exports.getFriends = async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId)
            .populate('friends', 'username avatar status')
            .select('friends');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user.friends);
    } catch (error) {
        console.error('Get friends error:', error);
        res.status(500).json({ message: 'Error getting friends' });
    }
};

// Add friend
exports.addFriend = async (req, res) => {
    try {
        const { friendId } = req.body;
        const userId = req.user._id;

        // Check if friend exists
        const friend = await User.findById(friendId);
        if (!friend) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if already friends
        const user = await User.findById(userId);
        if (user.friends.includes(friendId)) {
            return res.status(400).json({ message: 'Already friends' });
        }

        // Add friend to both users
        await User.findByIdAndUpdate(userId, {
            $push: { friends: friendId }
        });

        await User.findByIdAndUpdate(friendId, {
            $push: { friends: userId }
        });

        // Emit socket event
        req.app.get('io').emit('friendAdded', {
            userId,
            friendId
        });

        res.json({ message: 'Friend added successfully' });
    } catch (error) {
        console.error('Add friend error:', error);
        res.status(500).json({ message: 'Error adding friend' });
    }
};

// Remove friend
exports.removeFriend = async (req, res) => {
    try {
        const { friendId } = req.params;
        const userId = req.user._id;

        // Remove friend from both users
        await User.findByIdAndUpdate(userId, {
            $pull: { friends: friendId }
        });

        await User.findByIdAndUpdate(friendId, {
            $pull: { friends: userId }
        });

        // Emit socket event
        req.app.get('io').emit('friendRemoved', {
            userId,
            friendId
        });

        res.json({ message: 'Friend removed successfully' });
    } catch (error) {
        console.error('Remove friend error:', error);
        res.status(500).json({ message: 'Error removing friend' });
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
        const userId = req.user._id;

        if (!['online', 'offline'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { status },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Emit socket event
        req.app.get('io').emit('userStatusChanged', {
            userId: user._id,
            status: user.status
        });

        res.json(user);
    } catch (error) {
        console.error('Update status error:', error);
        res.status(500).json({ message: 'Error updating status' });
    }
};

