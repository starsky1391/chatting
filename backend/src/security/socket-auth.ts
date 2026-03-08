import { Server, Socket } from 'socket.io';
import { JWTUtil } from './jwt';

/**
 * Socket.io认证中间件
 * 用于在建立连接前验证JWT令牌
 */
export const socketAuthMiddleware = (io: Server) => {
  io.use((socket: Socket, next) => {
    try {
      // 从查询参数中获取token
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      // 验证token
      const payload = JWTUtil.verifyToken(token as string);

      // 验证是否为accessToken
      if (payload.type !== 'access') {
        return next(new Error('Invalid token type'));
      }

      // 将用户信息添加到socket对象中
      socket.data.user = {
        userId: payload.userId,
        username: payload.username
      };

      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });
};
