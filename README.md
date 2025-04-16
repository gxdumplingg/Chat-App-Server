# Chat App Server

A real-time chat application server built with Node.js, Express, MongoDB, and Socket.IO.

## Features

- Real-time messaging using Socket.IO
- JWT authentication
- Group and private conversations
- Message status (read/unread)
- User online/offline status
- File attachments support

## API Documentation

### Authentication

#### Register
```bash
POST /auth/register
Content-Type: application/json

{
    "username": "string",
    "email": "string",
    "password": "string"
}
```

#### Login
```bash
POST /auth/login
Content-Type: application/json

{
    "email": "string",
    "password": "string"
}
```

### Conversations

#### Create Conversation
```bash
POST /conversations
Authorization: Bearer <token>
Content-Type: application/json

{
    "participants": ["user_id_1", "user_id_2"],
    "name": "string",
    "type": "group|private"
}
```

#### Get User Conversations
```bash
GET /conversations/:userId
Authorization: Bearer <token>
```

#### Update Conversation
```bash
PUT /conversations/:id
Authorization: Bearer <token>
Content-Type: application/json

{
    "name": "string",
    "participants": ["user_id_1", "user_id_2"]
}
```

#### Delete Conversation
```bash
DELETE /conversations/:id
Authorization: Bearer <token>
```

#### Leave Conversation
```bash
POST /conversations/:id/leave
Authorization: Bearer <token>
Content-Type: application/json

{
    "userId": "string"
}
```

### Messages

#### Send Message
```bash
POST /message
Authorization: Bearer <token>
Content-Type: application/json

{
    "conversationId": "string",
    "senderId": "string",
    "text": "string",
    "messageType": "text|file"
}
```

#### Get Conversation Messages
```bash
GET /message/:conversationId
Authorization: Bearer <token>
```

#### Mark Message as Read
```bash
PUT /message/:id/read
Authorization: Bearer <token>
Content-Type: application/json

{
    "userId": "string"
}
```

#### Get Unread Messages
```bash
GET /message/unread/:userId
Authorization: Bearer <token>
```

## Socket.IO Events

### Connection
```javascript
socket.on('connect', () => {
    console.log('Connected to server');
});
```

### Authentication
```javascript
socket.on('authenticated', (user) => {
    console.log('Authenticated:', user);
});
```

### Messages
```javascript
// Send message
socket.emit('sendMessage', {
    conversationId: 'string',
    senderId: 'string',
    text: 'string',
    messageType: 'text'
});

// Receive message
socket.on('receiveMessage', (data) => {
    console.log('New message:', data);
});

// Message status updated
socket.on('messageStatusUpdated', (data) => {
    console.log('Message status updated:', data);
});
```

### Conversations
```javascript
// Join conversation
socket.emit('joinConversation', 'conversation_id');

// Leave conversation
socket.emit('leaveConversation', 'conversation_id');

// Conversation updated
socket.on('conversationUpdated', (conversation) => {
    console.log('Conversation updated:', conversation);
});

// Conversation deleted
socket.on('conversationDeleted', (conversationId) => {
    console.log('Conversation deleted:', conversationId);
});
```

## Environment Variables

Create a `.env` file in the root directory:

```bash
PORT=3000
MONGODB_URI=mongodb://localhost:27017/chat-app
JWT_SECRET=your_jwt_secret_key_here
```

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```
3. Start the server:
```bash
npm start
```

## Testing

Use the provided `test.html` file to test the real-time functionality:

1. Open `test.html` in a browser
2. Enter a user ID and connect
3. Join a conversation
4. Send and receive messages in real-time

## Setup Instructions

### 1. Prerequisites
- Node.js (v14 or higher)
- MongoDB (6.0.21)
- Git

### 2. Installation
```bash
git clone <repository-url>

# Install dependencies
npm install

# Create .env file
cp .env.example .env
```

### 3. Environment Configuration
Edit the `.env` file with your configuration:
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/chat-app
JWT_SECRET=your-secret-key-here
```

### 4. Database Setup
```bash
# Start MongoDB service
net start MongoDB


# Run seed data
node seed.js
```

### 5. Start the Server
```bash
nodemon app

```

## Important Notes
1. Make sure MongoDB is running before starting the server
2. The server runs on port 3000 by default
3. All API endpoints require authentication except login
4. Use the token received from login for subsequent requests
5. For frontend development, configure CORS in your frontend to allow requests from `http://localhost:3000`
6. JWT tokens expire after 24 hours - implement token refresh logic in your frontend

## Troubleshooting
1. If MongoDB connection fails:
   - Check if MongoDB service is running
   - Verify MongoDB URI in .env file
   - Check MongoDB logs for errors

2. If API requests fail:
   - Verify token is valid and not expired
   - Check request headers and body format
   - Check server logs for error messages
   - If token is expired, login again to get a new token

## Support
For any issues or questions, please contact the backend team. 