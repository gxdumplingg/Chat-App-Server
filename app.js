const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Kết nối MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chat-app', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    family: 4
}).then(() => {
    console.log('MongoDB connected successfully');
}).catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});

// Routes
const authRoute = require('./routes/authRoute');
app.use('/auth', authRoute);

const userRoute = require('./routes/userRoute');
app.use('/users', userRoute);
const messageRoute = require('./routes/messageRoute')(io);
app.use('/message', messageRoute);


const conversationRoute = require('./routes/conversationRoute');
app.use('/conversations', conversationRoute);

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Join conversation room
    socket.on('joinConversation', (conversationId) => {
        socket.join(conversationId);
        console.log(`User joined conversation: ${conversationId}`);
    });

    // Leave conversation room
    socket.on('leaveConversation', (conversationId) => {
        socket.leave(conversationId);
        console.log(`User left conversation: ${conversationId}`);
    });

    // Send message
    socket.on('sendMessage', async (data) => {
        try {
            const { conversationId, senderId, text, messageType = 'text' } = data;

            // Lưu message vào database
            const Message = require('./models/Message');
            const message = new Message({
                conversationId: conversationId,
                senderId: senderId,
                text,
                messageType
            });
            await message.save();

            // Cập nhật lastMessage của conversation
            const Conversation = require('./models/Conversation');
            const conversation = await Conversation.findByIdAndUpdate(conversationId, {
                lastMessage: message._id,
                updatedAt: new Date()
            }, { new: true })
                .populate('participants', 'username avatar status lastSeen')
                .populate('lastMessage');

            // Gửi message đến tất cả users trong conversation
            io.to(conversationId).emit('receiveMessage', {
                message: message,
                conversation: conversation
            });

            // Gửi cập nhật conversation đến tất cả participants
            conversation.participants.forEach(participant => {
                io.to(participant._id.toString()).emit('conversationUpdated', conversation);
            });
        } catch (error) {
            console.error('Error sending message:', error);
            socket.emit('error', { message: 'Error sending message' });
        }
    });

    // Get conversations
    socket.on('getConversations', async (userId) => {
        try {
            const Conversation = require('./models/Conversation');
            const conversations = await Conversation.find({
                participants: userId
            })
                .populate('participants', 'username avatar status lastSeen')
                .populate('lastMessage')
                .sort({ updatedAt: -1 });

            socket.emit('conversations', conversations);
        } catch (error) {
            console.error('Error getting conversations:', error);
            socket.emit('error', { message: 'Error getting conversations' });
        }
    });

    // Update message status
    socket.on('updateMessageStatus', async (data) => {
        try {
            const { messageId, userId, status } = data;
            const Message = require('./models/Message');
            const message = await Message.findById(messageId);

            if (message) {
                message.status.set(userId, status);
                await message.save();

                // Gửi cập nhật status đến tất cả users trong conversation
                io.to(message.conversationId.toString()).emit('messageStatusUpdated', {
                    messageId,
                    userId,
                    status
                });
            }
        } catch (error) {
            console.error('Error updating message status:', error);
        }
    });

    // Handle typing status
    socket.on('typing', (data) => {
        socket.to(data.conversationId).emit('userTyping', {
            userId: data.userId,
            isTyping: data.isTyping
        });
    });

    // Handle user status
    socket.on('updateUserStatus', (data) => {
        socket.broadcast.emit('userStatusChanged', {
            userId: data.userId,
            status: data.status
        });
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
