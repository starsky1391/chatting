// API路由配置文件
// 用于定义和组织所有API端点
// 路由配置遵循RESTful设计原则，按功能模块分组
import { Router } from 'express';
// 导入控制器，处理具体的请求逻辑
import { AuthController } from '../controllers/AuthController';
import { ChannelController } from '../controllers/ChannelController';
import { MessageController } from '../controllers/MessageController';
import { UploadController } from '../controllers/UploadController';
// 导入认证中间件，用于保护需要认证的路由
import { authMiddleware } from '../middleware/auth';

// 创建控制器实例
// 控制器负责处理具体的请求逻辑
const authController = new AuthController();
const channelController = new ChannelController();
const messageController = new MessageController();
const uploadController = new UploadController();

// 创建路由实例
// Router是Express的路由处理器，用于组织和管理路由
const router = Router();

// ----------------------
// 公共路由（无需认证）
// ----------------------

// 认证相关路由
// 登录和注册路由不需要认证，允许匿名访问
// 登录：POST /api/auth/login - 使用邮箱和密码登录
// 注册：POST /api/auth/register - 创建新用户
// 刷新token：POST /api/auth/refresh - 使用refreshToken刷新accessToken
router.post('/auth/login', authController.login.bind(authController));
router.post('/auth/register', authController.register.bind(authController));
router.post('/auth/refresh', authController.refreshToken.bind(authController));

// ----------------------
// 受保护路由（需要认证）
// ----------------------

// 应用认证中间件
// 从这里开始，所有路由都需要JWT令牌认证
// 中间件会验证请求头中的Authorization令牌
// 认证失败会返回401 Unauthorized响应
router.use(authMiddleware);

// ----------------------
// 用户相关路由
// ----------------------

// 获取当前登录用户信息
// GET /api/users/me - 返回当前认证用户的详细信息
// 从req.user中获取用户信息，该信息由authMiddleware附加
router.get('/users/me', authController.getCurrentUser.bind(authController));

// ----------------------
// 频道相关路由
// ----------------------

// 获取所有频道
// GET /api/channels - 返回当前用户的频道列表
// 用于前端显示频道列表
router.get('/channels', channelController.getAllChannels.bind(channelController));

// 获取单个频道详情
// GET /api/channels/:id - 返回指定ID的频道详细信息
// :id是路径参数，表示频道ID
router.get('/channels/:id', channelController.getChannelById.bind(channelController));

// 创建新频道
// POST /api/channels - 创建一个新的频道
// 请求体中需要包含频道名称和类型
router.post('/channels', channelController.createChannel.bind(channelController));

// 获取频道成员
// GET /api/channels/:id/members - 返回指定频道的所有成员
// 用于前端显示频道成员列表
router.get('/channels/:id/members', channelController.getChannelMembers.bind(channelController));

// 加入频道
// POST /api/channels/:id/join - 当前用户加入指定频道
// :id是路径参数，表示频道ID
router.post('/channels/:id/join', channelController.joinChannel.bind(channelController));

// 离开频道
// POST /api/channels/:id/leave - 当前用户离开指定频道
// :id是路径参数，表示频道ID
router.post('/channels/:id/leave', channelController.leaveChannel.bind(channelController));

// ----------------------
// 消息相关路由
// ----------------------

// 获取频道消息
// GET /api/channels/:id/messages - 返回指定频道的消息列表
// 支持分页，通过limit和before查询参数控制
// 例如：/api/channels/1/messages?limit=50&before=100
router.get('/channels/:id/messages', messageController.getMessagesByChannelId.bind(messageController));

// 创建新消息
// POST /api/channels/:id/messages - 在指定频道创建一条新消息
// 请求体中需要包含消息内容
// 消息创建后，会通过Socket.io广播给频道中的所有成员
router.post('/channels/:id/messages', messageController.createMessage.bind(messageController));

// ----------------------
// 上传相关路由
// ----------------------

// 上传图片
// POST /api/upload - 上传单张图片到服务器
// 请求中需要包含form-data格式的image字段
// 返回图片的访问URL
router.post('/upload', uploadController.uploadImage.bind(uploadController));

// 导出路由实例
// 用于在index.ts中注册到Express应用
// 所有路由都会被挂载到/api前缀下
// 例如：/api/auth/login, /api/channels等
export default router;