const express = require('express');
const conversationController = require('../controllers/conversationController');
const auth = require('../middlewares/auth');

module.exports = (io) => {
    const router = express.Router();

    // Get all conversations for the authenticated user
    router.get('/', auth, conversationController.getConversations);

    // Create a new conversation
    router.post('/', auth, conversationController.createConversation);

    // Update conversation details
    router.put('/:id', auth, conversationController.updateConversation);

    // Delete conversation
    router.delete('/:id', auth, conversationController.deleteConversation);

    // Add participant to conversation
    router.post('/:id/participants', auth, conversationController.addParticipant);

    // Remove participant from conversation
    router.delete('/:id/participants/:userId', auth, conversationController.removeParticipant);

    // Leave conversation
    router.post('/:id/leave', auth, conversationController.leaveConversation);

    // Mark conversation as read
    router.put('/:id/read', auth, conversationController.markAsRead);

    return router;
}; 