// 认证控制器
// 处理用户认证相关的HTTP请求，包括登录、注册、刷新token和获取当前用户信息
// 控制器负责接收请求、验证参数、调用服务层处理业务逻辑，并返回响应
import { Request, Response } from 'express';
// 导入认证服务，处理实际的认证业务逻辑
import { AuthService } from '../services/AuthService';
// 导入响应工具类，用于统一响应格式
import ResponseUtil from '../utils/response';

export class AuthController {
  // 认证服务实例，用于调用认证相关的业务逻辑
  private authService: AuthService;

  // 构造函数，初始化认证服务实例
  constructor() {
    this.authService = new AuthService();
  }

  /**
   * 用户登录
   * @param req Request对象，包含登录请求的email和password
   * @param res Response对象，用于返回登录结果
   * @returns 返回登录成功的用户信息和JWT令牌，或登录失败的错误信息
   */
  async login(req: Request, res: Response) {
    try {
      // 从请求体中获取登录凭证
      const { email, password } = req.body;
      
      // 验证必填字段
      if (!email || !password) {
        return ResponseUtil.badRequest(res, 'Email and password are required');
      }

      // 调用认证服务的login方法进行登录验证
      // login方法会验证用户凭证，并生成JWT令牌
      const result = await this.authService.login({ email, password });
      
      // 将refreshToken存入HttpOnly Cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7天
      });
      
      // 从响应中移除refreshToken，只返回accessToken和用户信息
      const { refreshToken, ...responseData } = result;
      
      // 返回登录成功响应，包含用户信息和accessToken
      return ResponseUtil.success(res, responseData, 'Login successful');
    } catch (error) {
      // 捕获并返回登录错误
      return ResponseUtil.badRequest(res, error instanceof Error ? error.message : 'Login failed');
    }
  }

  /**
   * 用户注册
   * @param req Request对象，包含注册请求的username、email、password和可选的avatar
   * @param res Response对象，用于返回注册结果
   * @returns 返回注册成功的用户信息和JWT令牌，或注册失败的错误信息
   */
  async register(req: Request, res: Response) {
    try {
      // 从请求体中获取注册信息
      const { username, email, password, avatar } = req.body;
      
      // 验证必填字段
      if (!username || !email || !password) {
        return ResponseUtil.badRequest(res, 'Username, email and password are required');
      }

      // 调用认证服务的register方法进行用户注册
      // register方法会创建新用户，加密密码，并生成JWT令牌
      const result = await this.authService.register({
        username,
        email,
        password,
        // 如果没有提供头像，使用用户名的首个字母
        avatar: avatar || username.charAt(0).toUpperCase()
      });
      
      // 将refreshToken存入HttpOnly Cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7天
      });
      
      // 从响应中移除refreshToken，只返回accessToken和用户信息
      const { refreshToken, ...responseData } = result;
      
      // 返回注册成功响应，包含新创建的用户信息和accessToken
      return ResponseUtil.created(res, responseData, 'Registration successful');
    } catch (error) {
      // 捕获并返回注册错误
      // 处理Sequelize验证错误
      if (error instanceof Error) {
        // 检查是否为Sequelize验证错误
        if ((error as any).name === 'SequelizeValidationError') {
          const validationError = error as any;
          const firstError = validationError.errors[0];
          let errorMessage = 'Registration failed';
          
          // 根据字段和验证类型返回友好提示
          if (firstError.path === 'username') {
            if (firstError.validatorKey === 'len') {
              errorMessage = 'Username must be between 3 and 50 characters long';
            } else if (firstError.validatorKey === 'notEmpty') {
              errorMessage = 'Username is required';
            } else if (firstError.validatorKey === 'isUnique') {
              errorMessage = 'Username already exists';
            }
          } else if (firstError.path === 'email') {
            if (firstError.validatorKey === 'isEmail') {
              errorMessage = 'Please enter a valid email address';
            } else if (firstError.validatorKey === 'notEmpty') {
              errorMessage = 'Email is required';
            } else if (firstError.validatorKey === 'isUnique') {
              errorMessage = 'Email already exists';
            }
          } else if (firstError.path === 'password') {
            if (firstError.validatorKey === 'len') {
              errorMessage = 'Password must be between 6 and 100 characters long';
            } else if (firstError.validatorKey === 'notEmpty') {
              errorMessage = 'Password is required';
            }
          } else {
            // 默认使用原始错误信息
            errorMessage = firstError.message;
          }
          
          return ResponseUtil.badRequest(res, errorMessage);
        } 
        // 处理其他已知错误
        else if (error.message === 'User already exists') {
          return ResponseUtil.badRequest(res, 'Email already in use');
        }
      }
      
      // 未知错误，返回通用提示
      return ResponseUtil.badRequest(res, error instanceof Error ? error.message : 'Registration failed');
    }
  }

  /**
   * 刷新访问令牌
   * @param req Request对象，包含refreshToken
   * @param res Response对象，用于返回新的accessToken
   * @returns 返回新的accessToken，或刷新失败的错误信息
   */
  async refreshToken(req: Request, res: Response) {
    try {
      // 从Cookie中获取refreshToken
      const refreshToken = req.cookies?.refreshToken;
      
      // 验证refreshToken
      if (!refreshToken) {
        return ResponseUtil.badRequest(res, 'Refresh token is required');
      }

      // 调用认证服务的refreshToken方法刷新令牌
      const result = await this.authService.refreshToken(refreshToken);
      
      // 返回刷新成功响应，包含新的accessToken
      return ResponseUtil.success(res, result, 'Token refreshed successfully');
    } catch (error) {
      // 捕获并返回刷新错误
      return ResponseUtil.unauthorized(res, error instanceof Error ? error.message : 'Failed to refresh token');
    }
  }

  /**
   * 获取当前登录用户信息
   * @param req Request对象，包含通过认证中间件添加的user属性
   * @param res Response对象，用于返回用户信息
   * @returns 返回当前登录用户的详细信息，或未授权的错误信息
   */
  async getCurrentUser(req: Request, res: Response) {
    try {
      // 验证用户是否已通过认证
      // 认证中间件会在请求头中验证JWT令牌，并将用户信息添加到req.user
      if (!req.user) {
        return ResponseUtil.unauthorized(res, 'Unauthorized');
      }
      
      // 返回当前用户信息
      return ResponseUtil.success(res, req.user, 'User retrieved successfully');
    } catch (error) {
      // 捕获并返回服务器错误
      return ResponseUtil.internalError(res, 'Failed to get user');
    }
  }
}