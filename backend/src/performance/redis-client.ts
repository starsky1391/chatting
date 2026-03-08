import Redis from 'ioredis';
import config from '../config';

// 创建Redis客户端实例
export const redisClient = new Redis(config.redis.url);

// 测试Redis连接
redisClient.on('connect', () => {
  console.log('✓ Redis connected successfully');
});

// 处理Redis错误
redisClient.on('error', (error) => {
  console.error('✗ Redis connection error:', error);
});

// 导出Redis客户端
export default redisClient;
