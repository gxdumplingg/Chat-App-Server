const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { cloudinary, upload } = require('./config/cloudinary');
const User = require('./models/User');

// Load env variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// CORS configuration
const corsOptions = {
    origin: ['http://localhost:5500', 'http://127.0.0.1:5500'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true
};

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Create temp directory if it doesn't exist
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, tempDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const uploadMiddleware = multer({ storage: storage });

// Logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    next();
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-app', {
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

// Socket.IO setup
const io = socketIo(server, {
    cors: corsOptions
});

// Routes
const { router: authRoute, auth } = require('./routes/authRoute');
const userRoute = require('./routes/userRoute');
const messageRoute = require('./routes/messageRoute')(io);
const conversationRoute = require('./routes/conversationRoute')(io);
const mediaRoute = require('./routes/mediaRoute');

// Routes
app.use('/auth', authRoute);
app.use('/users', userRoute);
app.use('/message', auth, messageRoute);
app.use('/conversations', auth, conversationRoute);
app.use('/media', auth, mediaRoute);

// Make io accessible to routes
app.set('io', io);

// Socket.IO authentication middleware
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error('Authentication error'));
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.userId;
        next();
    } catch (error) {
        return next(new Error('Authentication error'));
    }
});

// Store online users
const onlineUsers = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Add user to online users
    onlineUsers.set(socket.userId, socket.id);

    // Update user status to online
    User.findByIdAndUpdate(socket.userId, {
        status: 'online',
        lastSeen: new Date()
    }).then(() => {
        // Notify all friends about the status change
        io.emit('userStatusChanged', {
            userId: socket.userId,
            status: 'online'
        });
    });

    // Get online friends
    socket.on('getOnlineFriends', async (userId) => {
        try {
            const user = await User.findById(userId).populate('friends', 'username avatar status lastSeen');
            if (!user) {
                console.log('User not found:', userId);
                return socket.emit('onlineFriends', []);
            }

            // Ensure friends array exists
            const friends = user.friends || [];
            const onlineFriends = friends.filter(friend =>
                onlineUsers.has(friend._id.toString())
            );
            socket.emit('onlineFriends', onlineFriends);
        } catch (error) {
            console.error('Error getting online friends:', error);
            socket.emit('onlineFriends', []);
        }
    });

    // Update user status
    socket.on('updateUserStatus', async (data) => {
        try {
            const { status } = data;
            await User.findByIdAndUpdate(socket.userId, {
                status,
                lastSeen: new Date()
            });

            // Notify all friends about the status change
            io.emit('userStatusChanged', {
                userId: socket.userId,
                status
            });
        } catch (error) {
            console.error('Error updating user status:', error);
        }
    });

    // Join conversation room
    socket.on('joinConversation', (conversationId) => {
        socket.join(conversationId);
        console.log(`User joined conversation: ${conversationId}`);
    });

    // Leave conversation
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

    // Disconnect
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);

        // Remove user from online users
        onlineUsers.delete(socket.userId);

        // Update user status to offline
        User.findByIdAndUpdate(socket.userId, {
            status: 'offline',
            lastSeen: new Date()
        }).then(() => {
            // Notify all friends about the status change
            io.emit('userStatusChanged', {
                userId: socket.userId,
                status: 'offline'
            });
        });
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        message: 'Internal server error',
        error: err.message
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
