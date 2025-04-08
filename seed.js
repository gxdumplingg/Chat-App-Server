require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');
const bcrypt = require('bcryptjs');

// Kết nối MongoDB với các options
mongoose.connect('mongodb://127.0.0.1:27017/chat-app', {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    family: 4
}).then(() => {
    console.log('MongoDB connected for seeding');
    seedData();
}).catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});

const seedData = async () => {
    try {
        // Xóa dữ liệu cũ
        await User.deleteMany({});
        await Conversation.deleteMany({});
        await Message.deleteMany({});

        // Tạo users
        const users = [
            {
                username: 'John Doe',
                email: 'john@example.com',
                password: await bcrypt.hash('password', 10),
                avatar: 'https://i.pravatar.cc/150?img=1',
                status: 'online'
            },
            {
                username: 'Jane Smith',
                email: 'jane@example.com',
                password: await bcrypt.hash('password', 10),
                avatar: 'https://i.pravatar.cc/150?img=2',
                status: 'online'
            },
            {
                username: 'Mike Johnson',
                email: 'mike@example.com',
                password: await bcrypt.hash('password', 10),
                avatar: 'https://i.pravatar.cc/150?img=3',
                status: 'offline'
            },
            {
                username: 'Sarah Wilson',
                email: 'sarah@example.com',
                password: await bcrypt.hash('password', 10),
                avatar: 'https://i.pravatar.cc/150?img=4',
                status: 'online'
            }
        ];

        const createdUsers = await User.insertMany(users);
        console.log('Created users:', createdUsers.length);

        // Tạo conversations
        const conversations = [
            {
                participants: [createdUsers[0]._id, createdUsers[1]._id],
                type: 'private'
            },
            {
                participants: [createdUsers[0]._id, createdUsers[2]._id],
                type: 'private'
            },
            {
                participants: [createdUsers[0]._id, createdUsers[1]._id, createdUsers[2]._id, createdUsers[3]._id],
                type: 'group',
                groupName: 'Team Chat',
                groupAvatar: 'https://i.pravatar.cc/150?img=5'
            }
        ];

        const createdConversations = await Conversation.insertMany(conversations);
        console.log('Created conversations:', createdConversations.length);

        // Tạo messages
        const messages = [
            {
                conversationId: createdConversations[0]._id,
                senderId: createdUsers[0]._id,
                text: 'Hello Jane! How are you?',
                messageType: 'text'
            },
            {
                conversationId: createdConversations[0]._id,
                senderId: createdUsers[1]._id,
                text: 'Hi John! I\'m good, thanks for asking. How about you?',
                messageType: 'text'
            },
            {
                conversationId: createdConversations[1]._id,
                senderId: createdUsers[0]._id,
                text: 'Hey Mike, are you coming to the meeting tomorrow?',
                messageType: 'text'
            },
            {
                conversationId: createdConversations[2]._id,
                senderId: createdUsers[0]._id,
                text: 'Good morning team! Let\'s discuss the project updates.',
                messageType: 'text'
            },
            {
                conversationId: createdConversations[2]._id,
                senderId: createdUsers[1]._id,
                text: 'Morning! I\'ve completed the UI design.',
                messageType: 'text'
            },
            {
                conversationId: createdConversations[2]._id,
                senderId: createdUsers[2]._id,
                text: 'I\'ll be working on the backend today.',
                messageType: 'text'
            }
        ];

        const createdMessages = await Message.insertMany(messages);
        console.log('Created messages:', createdMessages.length);

        // Cập nhật lastMessage cho conversations
        for (let i = 0; i < createdConversations.length; i++) {
            const conversation = createdConversations[i];
            const lastMessage = createdMessages.filter(m => m.conversationId.equals(conversation._id))
                .sort((a, b) => b.createdAt - a.createdAt)[0];

            if (lastMessage) {
                await Conversation.findByIdAndUpdate(conversation._id, {
                    lastMessage: lastMessage._id
                });
            }
        }

        console.log('Seeding completed successfully!');
        process.exit();
    } catch (error) {
        console.error('Error seeding data:', error);
        process.exit(1);
    }
};
