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
const { swaggerUi, swaggerSpec } = require('./docs/swagger');

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
app.use(express.static('public')); // Serve static files from public directory

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
    cors: {
        origin: ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5500", "http://127.0.0.1:5500"],
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    allowEIO3: true
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
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Test route for WebSocket
app.get('/test', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'test.html'));
});

// Make io accessible to routes
app.set('io', io);

// Socket.IO authentication middleware
io.use((socket, next) => {
    try {
        // Check token in auth object or query parameters
        const token = socket.handshake.auth.token || socket.handshake.query.token;
        if (!token) {
            return next(new Error('Authentication error: No token provided'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.userId;
        next();
    } catch (error) {
        console.error('Socket authentication error:', error);
        return next(new Error('Authentication error: Invalid token'));
    }
});

// Store online users
const onlineUsers = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id, 'User ID:', socket.userId);

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
            status: 'online',
            lastSeen: new Date()
        });
    }).catch(error => {
        console.error('Error updating user status:', error);
    });

    // Handle authentication success
    socket.emit('auth', {
        status: 'success',
        userId: socket.userId
    });

    // Handle join conversation
    socket.on('join', (data) => {
        try {
            const { conversationId } = data;
            socket.join(conversationId);
            console.log(`User ${socket.userId} joined conversation: ${conversationId}`);
            socket.emit('joined', {
                conversationId,
                status: 'success',
                userId: socket.userId
            });
        } catch (error) {
            console.error('Error joining conversation:', error);
            socket.emit('error', { message: 'Error joining conversation' });
        }
    });

    // Handle message sending
    socket.on('message', async (data) => {
        try {
            const {
                conversationId,
                content,
                messageType = 'text',
                attachments = [] // Array of media URLs
            } = data;

            // Lưu message vào database
            const Message = require('./models/Message');
            const message = new Message({
                conversationId: conversationId,
                senderId: socket.userId,
                text: content,
                messageType,
                attachments: attachments
            });
            await message.save();

            // Update conversation's last message
            const Conversation = require('./models/Conversation');
            const conversation = await Conversation.findByIdAndUpdate(conversationId, {
                lastMessage: message._id,
                updatedAt: new Date()
            }, { new: true })
                .populate('participants', 'username avatar status lastSeen')
                .populate('lastMessage');

            // Send message to all users in conversation
            io.to(conversationId).emit('message', {
                message: {
                    _id: message._id,
                    conversationId: message.conversationId,
                    senderId: message.senderId,
                    text: message.text,
                    messageType: message.messageType,
                    attachments: message.attachments,
                    createdAt: message.createdAt
                },
                conversation: conversation
            });

            // Send conversation update to all participants
            conversation.participants.forEach(participant => {
                io.to(participant._id.toString()).emit('conversationUpdated', conversation);
            });
        } catch (error) {
            console.error('Error sending message:', error);
            socket.emit('error', { message: 'Error sending message' });
        }
    });

    // Handle typing status
    socket.on('typing', (data) => {
        try {
            const { conversationId, isTyping } = data;
            socket.to(conversationId).emit('typing', {
                userId: socket.userId,
                isTyping: isTyping,
                conversationId: conversationId
            });
        } catch (error) {
            console.error('Error handling typing status:', error);
        }
    });

    // Handle message status update
    socket.on('updateMessageStatus', async (data) => {
        try {
            const { messageId, status } = data;
            const Message = require('./models/Message');
            const message = await Message.findById(messageId);

            if (message) {
                message.status = status;
                await message.save();

                // Send status update to all users in conversation
                io.to(message.conversationId.toString()).emit('messageStatusUpdated', {
                    messageId: message._id,
                    userId: socket.userId,
                    status: status,
                    conversationId: message.conversationId
                });
            }
        } catch (error) {
            console.error('Error updating message status:', error);
            socket.emit('error', { message: 'Error updating message status' });
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id, 'User ID:', socket.userId);

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
                status: 'offline',
                lastSeen: new Date()
            });
        }).catch(error => {
            console.error('Error updating user status on disconnect:', error);
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
    console.log(`Server is running on ${PORT}`);
    console.log(`API docs available at http://localhost:${PORT}/api-docs`);
});