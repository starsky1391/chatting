// 频道控制器
// 处理频道相关的HTTP请求，包括获取、创建和管理频道
// 控制器负责接收请求、验证参数、调用服务层处理业务逻辑，并返回响应
import { Request, Response } from 'express';
// 导入频道服务，处理实际的频道业务逻辑
import { ChannelService } from '../services/ChannelService';
// 导入响应工具类，用于统一响应格式
import ResponseUtil from '../utils/response';

export class ChannelController {
  // 频道服务实例，用于调用频道相关的业务逻辑
  private channelService: ChannelService;

  // 构造函数，初始化频道服务实例
  constructor() {
    this.channelService = new ChannelService();
  }

  /**
   * 获取当前用户的所有频道
   * @param req Request对象，包含请求信息，通过authMiddleware获取用户信息
   * @param res Response对象，用于返回频道列表
   * @returns 返回当前用户的频道列表，或获取失败的错误信息
   */
  async getAllChannels(req: Request, res: Response) {
    try {
      // 从请求中获取当前用户信息，由authMiddleware添加
      if (!req.user) {
        return ResponseUtil.unauthorized(res, 'Unauthorized');
      }

      // 调用频道服务的getAllChannelsForUser方法获取当前用户的频道
      const channels = await this.channelService.getAllChannelsForUser(req.user.userId);
      // 返回成功响应，包含频道列表
      return ResponseUtil.success(res, channels, 'Channels retrieved successfully');
    } catch (error) {
      // 捕获并返回服务器错误
      return ResponseUtil.internalError(res, 'Failed to get channels');
    }
  }

  /**
   * 根据ID获取单个频道
   * @param req Request对象，包含路径参数id（频道ID）
   * @param res Response对象，用于返回频道详情
   * @returns 返回指定ID的频道详情，或未找到频道的错误信息
   */
  async getChannelById(req: Request, res: Response) {
    try {
      // 从路径参数中获取频道ID
      const { id } = req.params;
      // 将字符串ID转换为数字类型
      const channelId = parseInt(id);

      // 验证频道ID是否为有效数字
      if (isNaN(channelId)) {
        return ResponseUtil.badRequest(res, 'Invalid channel ID');
      }

      // 调用频道服务的getChannelById方法获取频道
      const channel = await this.channelService.getChannelById(channelId);
      // 检查频道是否存在
      if (!channel) {
        return ResponseUtil.notFound(res, 'Channel not found');
      }

      // 返回成功响应，包含频道详情
      return ResponseUtil.success(res, channel, 'Channel retrieved successfully');
    } catch (error) {
      // 捕获并返回服务器错误
      return ResponseUtil.internalError(res, 'Failed to get channel');
    }
  }

  /**
   * 创建新频道
   * @param req Request对象，包含请求体中的name、type和可选的description
   * @param res Response对象，用于返回创建的频道信息
   * @returns 返回创建成功的频道详情，或创建失败的错误信息
   * TODO: 文字频道与语音频道同名
   */
  async createChannel(req: Request, res: Response) {
    try {
      // 从请求中获取当前用户信息，由authMiddleware添加
      if (!req.user) {
        return ResponseUtil.unauthorized(res, 'Unauthorized');
      }

      // 从请求体中获取频道信息
      const { name, type, description } = req.body;

      // 验证必填字段
      if (!name || !type) {
        return ResponseUtil.badRequest(res, 'Name and type are required');
      }

      // 验证频道类型是否合法
      if (!['text', 'voice', 'video'].includes(type)) {
        return ResponseUtil.badRequest(res, 'Invalid channel type');
      }

      // 首先检查频道是否已存在
      let channel = await this.channelService.getChannelByName(name);

      if (channel) {
        // 频道已存在，检查用户是否已加入该频道
        const isUserInChannel = await this.channelService.isUserInChannel(req.user.userId, channel.id);
        if (isUserInChannel) {
          return ResponseUtil.badRequest(res, 'You are already in this channel');
        }
        
        // 用户未加入，添加关联关系
        await this.channelService.joinChannel(req.user.userId, channel.id);
        return ResponseUtil.success(res, channel, 'Joined channel successfully');
      } else {
        // 频道不存在，创建新频道
        channel = await this.channelService.createChannel({
          name,
          // 将type转换为联合类型，确保类型安全
          type: type as 'text' | 'voice' | 'video',
          // 描述可选，默认为空字符串
          description: description || '',
          creatorId: req.user.userId
        });
        
        // 返回创建成功响应，包含新创建的频道
        return ResponseUtil.created(res, channel, 'Channel created successfully');
      }
    } catch (error) {
      // 捕获并返回服务器错误
      return ResponseUtil.internalError(res, 'Failed to create or join channel');
    }
  }

  /**
   * 获取频道成员
   * @param req Request对象，包含路径参数id（频道ID）
   * @param res Response对象，用于返回频道成员列表
   * @returns 返回指定频道的成员列表，或获取失败的错误信息
   */
  async getChannelMembers(req: Request, res: Response) {
    try {
      // 从路径参数中获取频道ID
      const { id } = req.params;
      // 将字符串ID转换为数字类型
      const channelId = parseInt(id);

      // 验证频道ID是否为有效数字
      if (isNaN(channelId)) {
        return ResponseUtil.badRequest(res, 'Invalid channel ID');
      }

      // 调用频道服务的getChannelMembers方法获取频道成员
      // 该方法是异步的，需要使用await等待结果
      const members = await this.channelService.getChannelMembers(channelId);
      // 返回成功响应，包含频道成员列表
      return ResponseUtil.success(res, members, 'Channel members retrieved successfully');
    } catch (error) {
      // 捕获并返回服务器错误
      return ResponseUtil.internalError(res, 'Failed to get channel members');
    }
  }

  /**
   * 加入频道
   * @param req Request对象，包含路径参数id（频道ID）
   * @param res Response对象，用于返回加入结果
   * @returns 返回加入成功或失败的响应
   */
  async joinChannel(req: Request, res: Response) {
    try {
      // 从请求中获取当前用户信息，由authMiddleware添加
      if (!req.user) {
        return ResponseUtil.unauthorized(res, 'Unauthorized');
      }

      // 从路径参数中获取频道ID
      const { id } = req.params;
      // 将字符串ID转换为数字类型
      const channelId = parseInt(id);

      // 验证频道ID是否为有效数字
      if (isNaN(channelId)) {
        return ResponseUtil.badRequest(res, 'Invalid channel ID');
      }

      // 检查用户是否已经在频道中
      const isInChannel = await this.channelService.isUserInChannel(req.user.userId, channelId);
      if (isInChannel) {
        return ResponseUtil.badRequest(res, 'You are already in this channel');
      }

      // 调用频道服务的joinChannel方法加入频道
      await this.channelService.joinChannel(req.user.userId, channelId);

      // 返回成功响应
      return ResponseUtil.success(res, null, 'Joined channel successfully');
    } catch (error) {
      // 捕获并返回服务器错误
      return ResponseUtil.internalError(res, 'Failed to join channel');
    }
  }

  /**
   * 离开频道
   * @param req Request对象，包含路径参数id（频道ID）
   * @param res Response对象，用于返回离开结果
   * @returns 返回离开成功或失败的响应
   */
  async leaveChannel(req: Request, res: Response) {
    try {
      // 从请求中获取当前用户信息，由authMiddleware添加
      if (!req.user) {
        return ResponseUtil.unauthorized(res, 'Unauthorized');
      }

      // 从路径参数中获取频道ID
      const { id } = req.params;
      // 将字符串ID转换为数字类型
      const channelId = parseInt(id);

      // 验证频道ID是否为有效数字
      if (isNaN(channelId)) {
        return ResponseUtil.badRequest(res, 'Invalid channel ID');
      }

      // 检查用户是否在频道中
      const isInChannel = await this.channelService.isUserInChannel(req.user.userId, channelId);
      if (!isInChannel) {
        return ResponseUtil.badRequest(res, 'You are not in this channel');
      }

      // 调用频道服务的leaveChannel方法离开频道
      const result = await this.channelService.leaveChannel(req.user.userId, channelId);

      if (result) {
        // 返回成功响应
        return ResponseUtil.success(res, null, 'Left channel successfully');
      } else {
        // 返回失败响应
        return ResponseUtil.badRequest(res, 'Failed to leave channel');
      }
    } catch (error) {
      // 捕获并返回服务器错误
      return ResponseUtil.internalError(res, 'Failed to leave channel');
    }
  }
}