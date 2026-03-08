// 消息控制器
// 处理消息相关的HTTP请求，包括获取和创建消息
// 控制器负责接收请求、验证参数、调用服务层处理业务逻辑，并返回响应
import { Request, Response } from 'express';
// 导入消息服务，处理实际的消息业务逻辑
import { MessageService } from '../services/MessageService';
// 导入响应工具类，用于统一响应格式
import ResponseUtil from '../utils/response';

export class MessageController {
  // 消息服务实例，用于调用消息相关的业务逻辑
  private messageService: MessageService;

  // 构造函数，初始化消息服务实例
  constructor() {
    this.messageService = new MessageService();
  }

  /**
   * 根据频道ID获取消息列表
   * @param req Request对象，包含路径参数id（频道ID）和查询参数limit、before
   * @param res Response对象，用于返回消息列表
   * @returns 返回指定频道的消息列表，或获取失败的错误信息
   */
  async getMessagesByChannelId(req: Request, res: Response) {
    try {
      // 从路径参数中获取频道ID
      const { id } = req.params;
      // 将字符串ID转换为数字类型
      const channelId = parseInt(id);
      // 从查询参数中获取分页参数
      // limit: 每页消息数量，默认为50
      // before: 获取此时间戳之前的消息（用于分页加载历史消息）
      const { limit, before } = req.query;

      // 验证频道ID是否为有效数字
      if (isNaN(channelId)) {
        return ResponseUtil.badRequest(res, 'Invalid channel ID');
      }

      // 调用消息服务的getMessagesByChannelId方法获取消息
      // 方法参数：
      // - channelId: 频道ID
      // - limit: 每页消息数量
      // - before: 获取此时间戳之前的消息
      const messages = await this.messageService.getMessagesByChannelId(
        channelId,
        limit ? parseInt(limit as string) : 50,
        before as string
      );

      // 返回成功响应，包含消息列表
      return ResponseUtil.success(res, messages, 'Messages retrieved successfully');
    } catch (error) {
      // 捕获并返回服务器错误
      return ResponseUtil.internalError(res, 'Failed to get messages');
    }
  }

  /**
   * 创建新消息
   * @param req Request对象，包含路径参数id（频道ID）、请求体中的content，以及通过authMiddleware附加的user
   * @param res Response对象，用于返回创建的消息信息
   * @returns 返回创建成功的消息详情，或创建失败的错误信息
   */
  async createMessage(req: Request, res: Response) {
    try {
      // 从路径参数中获取频道ID
      const { id } = req.params;
      // 将字符串ID转换为数字类型
      const channelId = parseInt(id);
      // 从请求体中获取消息内容
      const { content } = req.body;

      // 验证频道ID是否为有效数字
      if (isNaN(channelId)) {
        return ResponseUtil.badRequest(res, 'Invalid channel ID');
      }

      // 验证消息内容是否存在
      if (!content) {
        return ResponseUtil.badRequest(res, 'Content is required');
      }

      // 验证用户是否已通过认证
      // authMiddleware会将用户信息附加到req.user
      if (!req.user) {
        return ResponseUtil.unauthorized(res, 'Unauthorized');
      }

      // 调用消息服务的createMessage方法创建新消息
      // 方法参数：
      // - content: 消息内容
      // - senderId: 发送者ID（从req.user中获取）
      // - channelId: 频道ID
      // - sender: 发送者信息（从req.user中获取）
      const newMessage = await this.messageService.createMessage({
        content,
        senderId: req.user.userId,
        channelId,
        sender: {
          id: req.user.userId,
          username: req.user.username,
          avatar: 'https://via.placeholder.com/40' // 这里可以从数据库中获取真实的头像
        }
      });

      // 通过Socket.io广播消息到指定频道
      // 从全局对象中获取io实例
      const io = (req as any).app.get('io');
      if (io) {
        io.to(`channel-${channelId}`).emit('message:create', newMessage);
      }

      // 返回创建成功响应，包含新创建的消息
      return ResponseUtil.created(res, newMessage, 'Message created successfully');
    } catch (error) {
      // 捕获并返回服务器错误
      return ResponseUtil.internalError(res, 'Failed to create message');
    }
  }
}