const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

exports.login = async (req, res) => {
    try {
        // Log request details
        console.log('=== Login Request ===');
        console.log('Headers:', req.headers);
        console.log('Body:', req.body);
        console.log('Content-Type:', req.headers['content-type']);
        console.log('Raw body:', JSON.stringify(req.body));

        // Validate request body
        if (!req.body || Object.keys(req.body).length === 0) {
            console.log('Empty request body');
            return res.status(400).json({
                message: 'Request body is required',
                received: req.body
            });
        }

        const { username, password } = req.body;

        // Validate required fields
        if (!username || !password) {
            console.log('Missing required fields:', { username: !!username, password: !!password });
            return res.status(400).json({
                message: 'Username and password are required',
                received: {
                    username: !!username,
                    password: !!password
                }
            });
        }

        // Find user
        console.log('Searching for user with username:', username);
        const user = await User.findOne({ username });
        if (!user) {
            console.log('User not found:', username);
            return res.status(401).json({
                message: 'Invalid username or password',
                details: 'User not found'
            });
        }

        // Validate password
        console.log('Validating password for user:', username);
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            console.log('Invalid password for user:', username);
            return res.status(401).json({
                message: 'Invalid username or password',
                details: 'Invalid password'
            });
        }

        // Generate token
        console.log('Generating token for user:', username);
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        // Update user status
        console.log('Updating user status to online:', username);
        user.status = 'online';
        user.lastSeen = new Date();
        await user.save();

        console.log('Login successful for user:', username);

        // Send response
        res.json({
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
        console.error('Error stack:', error.stack);
        res.status(500).json({
            message: 'Internal server error',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

exports.register = async (req, res) => {
    try {
        const { email, password, username, avatar, status } = req.body;

        // Kiểm tra các trường bắt buộc
        if (!email || !password || !username) {
            return res.status(400).json({ message: 'Email, password and username are required' });
        }

        // Kiểm tra email đã tồn tại chưa
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already exists' });
        }

        // Mã hóa password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Tạo user mới
        const user = new User({
            email,
            password: hashedPassword,
            username,
            avatar: avatar || 'https://example.com/default-avatar.jpg',
            status: status || 'active'
        });

        // Lưu user vào database
        await user.save();

        res.status(201).json({
            message: 'User registered successfully',
            user: {
                email: user.email,
                username: user.username,
                avatar: user.avatar,
                status: user.status
            }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({
            message: 'Internal server error',
            error: error.message
        });
    }
}; 