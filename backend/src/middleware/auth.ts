// 认证中间件
// 用于验证JWT令牌，保护需要认证的API路由
// 中间件会从请求头中提取JWT令牌，验证其有效性，并将用户信息附加到Request对象上
import { Request, Response, NextFunction } from 'express';
// 导入JWT工具类，用于JWT令牌的验证
import { JWTUtil } from '../security/jwt';
// 导入响应工具类，用于统一响应格式
import ResponseUtil from '../utils/response';

// 扩展Express的Request接口
// 在TypeScript中，默认的Request接口没有user属性
// 这里扩展接口，添加user属性，允许在请求对象中存储用户信息
// 这样在后续的请求处理中，可以通过req.user访问当前认证用户
// 类型定义仅在TypeScript编译时有效，运行时不影响

declare global {
  namespace Express {
    interface Request {
      // 用户信息，可选属性，因为未认证的请求没有user
      user?: {
        userId: number;      // 用户ID
        username: string;    // 用户名
      };
    }
  }
}

/**
 * JWT认证中间件
 * @param req Request对象，包含请求头中的Authorization令牌
 * @param res Response对象，用于返回认证结果
 * @param next NextFunction，用于调用下一个中间件或路由处理函数
 * @returns 如果认证成功，调用next()继续处理请求；否则返回401 Unauthorized响应
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // 从Authorization头中提取JWT令牌
  // 令牌格式通常为："Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  // 使用replace('Bearer ', '')移除前缀，只保留实际的令牌字符串
  const token = req.header('Authorization')?.replace('Bearer ', '');

  // 检查令牌是否存在
  // 如果请求头中没有Authorization字段，或令牌格式不正确，token将为undefined
  if (!token) {
    // 返回401未授权响应
    return ResponseUtil.unauthorized(res, 'No token provided');
  }

  try {
    // 验证JWT令牌的有效性
    // 使用JWTUtil.verifyToken方法，验证令牌并获取解码后的内容
    const decoded = JWTUtil.verifyToken(token);
    
    // 验证令牌类型是否为access
    if (decoded.type !== 'access') {
      return ResponseUtil.unauthorized(res, 'Invalid token type');
    }
    
    // 将用户信息附加到Request对象上
    // 从token中提取用户信息，避免每次请求都查询数据库
    req.user = {
      userId: decoded.userId,
      username: decoded.username
    };
    
    // 调用next()，继续处理请求
    // 进入下一个中间件或路由处理函数
    next();
  } catch (error) {
    // 捕获JWT验证错误
    // 可能的错误包括：令牌过期、签名无效、令牌格式错误等
    return ResponseUtil.unauthorized(res, 'Invalid token');
  }
};