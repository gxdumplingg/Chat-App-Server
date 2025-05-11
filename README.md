# Chat App Server

A real-time chat application server built with Node.js, Express, MongoDB, and Socket.IO.

## Features

- Real-time messaging using Socket.IO
- JWT authentication
- Group and private conversations
- Message status (read/unread)
- User online/offline status
- File attachments support

## Cài đặt

1. Clone repository
2. Cài đặt dependencies:
```bash
npm install
```
3. Tạo file `.env` với các biến môi trường:
```
MONGODB_URI=mongodb://localhost:27017/chat-app
JWT_SECRET=your_jwt_secret_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
PORT=3000
```
4. Khởi động server:
```bash
npm run dev
```

## API Documentation

### Authentication

#### Register
```
POST /auth/register
Body:
{
    "username": "string",
    "email": "string",
    "password": "string"
}
```

#### Login
```
POST /auth/login
Body:
{
    "email": "string",
    "password": "string"
}
```

### Users

#### Search Users
```
GET /users/search?query=keyword
Headers:
- Authorization: Bearer YOUR_TOKEN
```

#### Get User Info
```
GET /users/:userId
Headers:
- Authorization: Bearer YOUR_TOKEN
```

#### Get Friends List
```
GET /users/friends
Headers:
- Authorization: Bearer YOUR_TOKEN
```

#### Add Friend
```
POST /users/friends
Headers:
- Authorization: Bearer YOUR_TOKEN
Body:
{
    "friendId": "user_id_to_add"
}
```

#### Remove Friend
```
DELETE /users/friends/:friendId
Headers:
- Authorization: Bearer YOUR_TOKEN
```

#### Update Avatar
```
PUT /users/avatar
Headers:
- Authorization: Bearer YOUR_TOKEN
Body (form-data):
- avatar: [file]
```

#### Update Status
```
PUT /users/status
Headers:
- Authorization: Bearer YOUR_TOKEN
Body:
{
    "status": "online" | "offline"
}
```

### Messages

#### Send Message
```
POST /message
Headers:
- Authorization: Bearer YOUR_TOKEN
Body:
{
    "conversationId": "string",
    "text": "string",
    "messageType": "text" | "image" | "file"
}
```

#### Get Messages
```
GET /message/:conversationId
Headers:
- Authorization: Bearer YOUR_TOKEN
Query:
- page: number
- limit: number
```

#### Update Message Status
```
PUT /message/:messageId/status
Headers:
- Authorization: Bearer YOUR_TOKEN
Body:
{
    "status": "sent" | "delivered" | "read"
}
```

### Conversations

#### Create Conversation
```
POST /conversations
Headers:
- Authorization: Bearer YOUR_TOKEN
Body:
{
    "participants": ["user_id1", "user_id2"],
    "type": "private" | "group",
    "name": "string" // optional for group
}
```

#### Get Conversations
```
GET /conversations
Headers:
- Authorization: Bearer YOUR_TOKEN
```

#### Get Conversation Info
```
GET /conversations/:conversationId
Headers:
- Authorization: Bearer YOUR_TOKEN
```

#### Update Conversation
```
PUT /conversations/:conversationId
Headers:
- Authorization: Bearer YOUR_TOKEN
Body:
{
    "name": "string", // for group
    "avatar": "string" // for group
}
```

#### Leave Conversation
```
DELETE /conversations/:conversationId/leave
Headers:
- Authorization: Bearer YOUR_TOKEN
```

### Media

#### Upload Media
```
POST /media/upload
Headers:
- Authorization: Bearer YOUR_TOKEN
Body (form-data):
- image: [file]
```

#### Delete Media
```
DELETE /media/:publicId
Headers:
- Authorization: Bearer YOUR_TOKEN
```

#### Get Media Info
```
GET /media/info/:publicId
Headers:
- Authorization: Bearer YOUR_TOKEN
```

## Socket.IO Events

### Connection
```
Headers:
- token: JWT_TOKEN
```

### Events

#### Join Conversation
```
Event: joinConversation
Data: { conversationId: string }
```

#### Leave Conversation
```
Event: leaveConversation
Data: { conversationId: string }
```

#### Send Message
```
Event: sendMessage
Data: {
    conversationId: string,
    senderId: string,
    text: string,
    messageType: "text" | "image" | "file"
}
```

#### Receive Message
```
Event: receiveMessage
Data: {
    message: Message,
    conversation: Conversation
}
```

#### Update Message Status
```
Event: updateMessageStatus
Data: {
    messageId: string,
    userId: string,
    status: "sent" | "delivered" | "read"
}
```

#### User Status Changed
```
Event: userStatusChanged
Data: {
    userId: string,
    status: "online" | "offline",
    lastSeen: Date
}
```

#### User Typing
```
Event: userTyping
Data: {
    userId: string,
    conversationId: string,
    isTyping: boolean
}
```

#### New Friend
```
Event: newFriend
Data: {
    friend: {
        _id: string,
        username: string,
        email: string,
        avatar: string
    }
}
```

#### Friend Removed
```
Event: friendRemoved
Data: {
    friendId: string
}
```

## Models

### User
```javascript
{
    username: String,
    email: String,
    password: String,
    avatar: {
        url: String,
        publicId: String
    },
    status: String,
    lastSeen: Date,
    friends: [ObjectId]
}
```

### Message
```javascript
{
    conversationId: ObjectId,
    senderId: ObjectId,
    text: String,
    messageType: String,
    status: Map,
    createdAt: Date
}
```

### Conversation
```javascript
{
    participants: [ObjectId],
    type: String,
    name: String,
    avatar: String,
    lastMessage: ObjectId,
    createdAt: Date,
    updatedAt: Date
}
```

## Environment Variables

Create a `.env` file in the root directory:

```bash
PORT=3000
MONGODB_URI=mongodb://localhost:27017/chat-app
JWT_SECRET=your_jwt_secret_key
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