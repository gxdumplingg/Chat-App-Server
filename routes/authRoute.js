const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Đăng ký
router.post('/register', authController.register);

// Đăng nhập
router.post('/login', authController.login);

// Verify token
router.get('/verify', authController.verifyToken);

module.exports = { router, auth: authController.auth }; 