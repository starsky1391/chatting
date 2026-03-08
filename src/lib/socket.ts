import { io, Socket } from 'socket.io-client';
import { config } from './config';

// 全局socket实例
let socketInstance: Socket | null = null;
// 连接状态跟踪
let isConnecting = false;

// socket配置
const SOCKET_URL = config.api.socketUrl;
const SOCKET_OPTIONS = () => {
  const token = localStorage.getItem('token');
  return {
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 3, // 减少重连次数
    reconnectionDelay: 2000, // 增加重连间隔
    reconnectionDelayMax: 5000, // 最大重连间隔
    // 添加超时设置
    timeout: 10000,
    // 传递认证令牌
    auth: {
      token: token || ''
    }
  };
};

// 获取或创建socket实例
export const getSocket = (): Socket => {
  if (!socketInstance) {
    try {
      // 避免重复创建
      if (isConnecting) {
        return socketInstance!;
      }
      
      isConnecting = true;
      socketInstance = io(SOCKET_URL, SOCKET_OPTIONS());
      
      // 添加更详细的错误处理
      socketInstance.on('connect_error', (error) => {
        // 错误处理逻辑
      });
      
      socketInstance.on('reconnect_error', (error) => {
        // 错误处理逻辑
      });
      
      socketInstance.on('disconnect', (reason) => {
        isConnecting = false;
      });
      
      socketInstance.on('connect', () => {
        isConnecting = false;
      });
      
    } catch (error) {
      isConnecting = false;
      // 即使出错，也要返回一个有效的socket实例
      const options = SOCKET_OPTIONS();
      socketInstance = io(SOCKET_URL, {
        ...options,
        // 出错时使用轮询模式
        transports: ['polling'],
      });
    }
  }
  return socketInstance;
};

// 断开并清理socket实例
export const cleanupSocket = (): void => {
  if (socketInstance) {
    try {
      socketInstance.disconnect();
      socketInstance = null;
      isConnecting = false; // 重置连接状态
    } catch (error) {
      socketInstance = null;
      isConnecting = false; // 重置连接状态
    }
  }
};
