# Chat App Backend Server

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

## API Documentation

### Authentication

#### Login
- **URL**: `/auth/login`
- **Method**: `POST`
- **Headers**: 
  - `Content-Type: application/json`
- **Body**:
```json
{
    "email": "user@example.com",
    "password": "password123"
}
```
- **Response**:
```json
{
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
        "email": "user@example.com",
        "name": "User Name"
    }
}
```

#### How to Use JWT Token
1. After successful login, you will receive a JWT token in the response
2. Store this token securely (e.g., in localStorage or sessionStorage)
3. For all subsequent API requests (except login), add the token to the request header:
   ```
   Authorization: Bearer <your-token>
   ```
4. The token will expire after 24 hours. You need to login again to get a new token

### Conversations

#### Get Conversations
- **URL**: `/conversations`
- **Method**: `GET`
- **Headers**: 
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`

#### Create Conversation
- **URL**: `/conversations`
- **Method**: `POST`
- **Headers**: 
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Body**:
```json
{
    "participants": ["user1@example.com", "user2@example.com"],
    "type": "private"
}
```

### Messages

#### Send Message
- **URL**: `/message`
- **Method**: `POST`
- **Headers**: 
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Body**:
```json
{
    "conversationId": "conversation_id",
    "text": "Hello, how are you?"
}
```

#### Get Messages
- **URL**: `/message/:conversationId`
- **Method**: `GET`
- **Headers**: 
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`

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