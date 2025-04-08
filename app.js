const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*", // Thay đổi thành domain của Flutter app trong môi trường production
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
mongoose.connect('mongodb://127.0.0.1:27017/chat-app', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000, // Tăng timeout lên 30 giây
    socketTimeoutMS: 45000, // Tăng socket timeout
    family: 4 // Force IPv4
}).then(() => {
    console.log('MongoDB connected successfully');
}).catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Thoát ứng dụng nếu không thể kết nối
});

// Routes
const authRoute = require('./routes/authRoute');
app.use('/auth', authRoute);

const userRoute = require('./routes/userRoute');
app.use('/users', userRoute);

const messageRoute = require('./routes/messageRoute');
app.use('/message', messageRoute);

const conversationRoute = require('./routes/conversationRoute');
app.use('/conversations', conversationRoute);

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('A user connected');

    // Join room based on user ID
    socket.on('join', (userId) => {
        socket.join(userId);
        console.log(`User ${userId} joined their room`);
    });

    // Handle sending messages
    socket.on('send_message', async (messageData) => {
        try {
            // Lưu tin nhắn vào database
            const message = new Message(messageData);
            await message.save();

            // Cập nhật lastMessage của conversation
            await Conversation.findByIdAndUpdate(
                messageData.conversationId,
                { lastMessage: message._id, updatedAt: Date.now() }
            );

            // Gửi tin nhắn đến tất cả người dùng trong conversation
            io.to(messageData.conversationId).emit('new_message', message);
        } catch (error) {
            console.error('Error sending message:', error);
        }
    });

    // Handle typing status
    socket.on('typing', (data) => {
        socket.to(data.conversationId).emit('user_typing', {
            userId: data.userId,
            isTyping: data.isTyping
        });
    });

    // Handle user status
    socket.on('update_status', (data) => {
        socket.broadcast.emit('user_status_changed', {
            userId: data.userId,
            status: data.status
        });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something broke!' });
});

// Khởi động server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
