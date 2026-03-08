import { Server } from 'socket.io';
import config from '../config';

/**
 * 配置Socket.io的Redis适配器
 * 用于支持多服务器水平扩展
 * @param io Socket.io服务器实例
 */
export const configureSocketAdapter = (io: Server): void => {
  try {
    // TODO: 配置Redis适配器
    // 暂时注释掉，待修复依赖问题
    /*
    // 创建Redis客户端
    const pubClient = new Redis(config.redis.url);
    const subClient = pubClient.duplicate();

    // 配置Redis适配器
    io.adapter(createAdapter(pubClient, subClient));

    console.log('✓ Socket.io Redis adapter configured successfully');
    */
    console.log('Using default Socket.io adapter');
  } catch (error) {
    console.error('✗ Error configuring Socket.io Redis adapter:', error);
    // 如果Redis连接失败，使用默认适配器
    console.log('Using default Socket.io adapter');
  }
};
