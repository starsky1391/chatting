# Chat Backend

A chat application backend built with Express, TypeScript, and Socket.io.

## Features

- User authentication with JWT
- Channel management
- Message handling
- Real-time communication with Socket.io
- MVC architecture
- TypeScript support
- CORS configuration

## Project Structure

```
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Request handlers
│   ├── middleware/      # Express middleware
│   ├── models/          # Data models
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── utils/           # Utility functions
│   └── index.ts         # Application entry point
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── .eslintrc.json       # ESLint configuration
└── README.md           # This file
```

## Installation

1. Install dependencies:

```bash
npm install
```

## Development

Start the development server with hot reload:

```bash
npm run dev
```

The server will be running on http://localhost:3001

## Build

Build the project for production:

```bash
npm run build
```

## Production

Start the production server:

```bash
npm start
```

## API Endpoints

### Authentication

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration

### Users

- `GET /api/users/me` - Get current user information

### Channels

- `GET /api/channels` - Get all channels
- `GET /api/channels/:id` - Get channel by ID
- `POST /api/channels` - Create a new channel
- `GET /api/channels/:id/members` - Get channel members

### Messages

- `GET /api/channels/:id/messages` - Get messages by channel ID
- `POST /api/channels/:id/messages` - Create a new message

## Socket.io Events

### Client to Server

- `join-channel` - Join a channel
- `leave-channel` - Leave a channel
- `send-message` - Send a message to a channel

### Server to Client

- `message:create` - New message created

## Response Format

All API responses follow this format:

```json
{
  "code": 200,
  "data": {},
  "msg": "success"
}
```

- `code` - HTTP status code
- `data` - Response data
- `msg` - Response message

## Environment Variables

- `PORT` - Server port (default: 3001)
- `JWT_SECRET` - JWT secret key (default: 'your-secret-key')
- `JWT_EXPIRES_IN` - JWT expiration time (default: '7d')
- `CORS_ORIGIN` - CORS origin (default: '*')

## License

MIT
