const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

exports.login = async (req, res) => {
    try {
        console.log('Login attempt with:', req.body);

        // Kiểm tra xem req.body có tồn tại không
        if (!req.body) {
            return res.status(400).json({ message: 'Request body is missing' });
        }

        const { email, password } = req.body;

        // Kiểm tra email và password
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        // Tìm user theo email
        const user = await User.findOne({ email });
        console.log('Found user:', user ? 'yes' : 'no');

        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Kiểm tra mật khẩu đã được mã hóa
        const isPasswordValid = await bcrypt.compare(password, user.password);
        console.log('Password valid:', isPasswordValid);

        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Tạo token
        const token = jwt.sign(
            { userId: user._id },
            'your-secret-key',
            { expiresIn: '24h' }
        );

        console.log('Login successful for user:', user.email);

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
        console.error('Login error details:', error);
        res.status(500).json({
            message: 'Internal server error',
            error: error.message
        });
    }
}; 