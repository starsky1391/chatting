export default {
  port: process.env.PORT || 3001,
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    accessTokenExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshTokenExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000'
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672'
  }
};
