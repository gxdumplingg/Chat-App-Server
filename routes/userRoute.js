const express = require("express");
const mongoose = require("mongoose");
const auth = require('../middlewares/auth');
const Friend = require('../models/Friend');
const Message = require("../models/Message");
const User = require("../models/User");
const { upload } = require('../config/cloudinary');
const userController = require('../controllers/userController');

const router = express.Router();



// Get user by ID
router.get("/:userId", auth, userController.getUserById);

// Get chat users
router.get("/chat/users/:userId", auth, userController.getChatUsers);

// Send friend request
router.post('/friend-request', auth, userController.sendFriendRequest);

// Accept friend request
router.put('/friend-request/:id/accept', auth, userController.acceptFriendRequest);

// Get friend requests
router.get('/friend-requests/:userId', auth, userController.getFriendRequests);

// Search users
router.get('/search', auth, userController.searchUsers);

// Get user's friends
router.get('/friends', auth, userController.getFriends);

// Add friend
router.post('/friends', auth, userController.addFriend);

// Remove friend
router.delete('/friends/:friendId', auth, userController.removeFriend);

// Update user avatar
router.put('/avatar', auth, upload.single('avatar'), userController.updateAvatar);

// Update user status
router.put('/status', auth, userController.updateStatus);

module.exports = router;
