// 引入dotenv用于加载环境变量
import dotenv from 'dotenv';
// 引入express框架
import express from 'express';
// 引入cors中间件，处理跨域请求
import cors from 'cors';
// 引入cookie-parser中间件，解析Cookie
import cookieParser from 'cookie-parser';
// 引入http模块，用于创建HTTP服务器
import { createServer } from 'http';
// 引入socket.io，用于实时通信
import { Server } from 'socket.io';
// 引入配置文件
import config from './config';
// 引入路由配置
import routes from './routes';
// 引入消息服务
import { MessageService } from './services/MessageService';
// 引入数据库模型和Sequelize实例
import { sequelize } from './models';

// 加载环境变量
// 从.env文件中读取配置，覆盖默认环境变量
// 这一行必须放在代码最前面，确保其他模块能使用环境变量
// 例如：process.env.PORT, process.env.JWT_SECRET等
// dotenv会根据项目根目录下的.env文件配置环境变量
dotenv.config();

// 导入Channel模型
import { Channel } from './models/Channel';

// 初始化数据库连接
// 在启动服务器前，确保数据库能正确连接
console.log('Connecting to database...');
sequelize.authenticate()
  .then(async () => {
    console.log('✓ Database connection established successfully');
    // 自动同步模型到数据库，使用alter: true
    console.log('Syncing models to database...');
    await sequelize.sync({
      alter: true,
      logging: console.log
    });
    console.log('✓ All models synced successfully');
  })
  .then(async () => {
    // 自动填充默认频道数据
    console.log('Checking for default channels...');
    const count = await Channel.count();
    if (count === 0) {
      console.log('No channels found, creating default channels...');
      await Channel.bulkCreate([
        { name: 'general', type: 'text', description: 'General discussion channel' },
        { name: 'random', type: 'text', description: 'Random topics and fun conversations' },
        { name: 'development', type: 'text', description: 'Development and coding discussion' },
        { name: 'design', type: 'text', description: 'Design and UI/UX discussion' },
        { name: 'voice-1', type: 'voice', description: 'General voice channel' },
        { name: 'voice-2', type: 'voice', description: 'Private voice channel' }
      ]);
      console.log('✓ Default channels created successfully');
    } else {
      console.log('✓ Default channels already exist');
    }
  })
  .catch((error) => {
    console.error('✗ Database connection failed:', error);
    // 数据库连接失败时退出进程
    process.exit(1);
  });

// 初始化Express应用
// 创建一个Express实例，用于处理HTTP请求
const app = express();

// 创建HTTP服务器
// 使用http模块的createServer方法，传入Express应用
// 这样可以同时支持HTTP请求和WebSocket连接
const server = createServer(app);

// 配置CORS
// cors中间件允许来自指定源的跨域请求
app.use(cors({
  origin: (origin, callback) => {
    // 允许没有 origin 的请求 (如移动端)
    if (!origin) return callback(null, true);
    
    // 允许任何以 .vercel.app 结尾的域名、localhost 以及你的 Railway 域名
    if (origin.endsWith('.vercel.app') || origin.includes('localhost') || origin.includes('railway.app')) {
      callback(null, true);
    } else {
      console.error('CORS 拒绝了来源:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // 必须为 true，因为前端带了 Cookie
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

// 配置中间件
// express.json()用于解析JSON格式的请求体
// 例如：POST请求中的JSON数据会被解析为req.body
app.use(express.json());

// express.urlencoded()用于解析URL编码的请求体
// extended: true表示使用qs库解析，支持嵌套对象
app.use(express.urlencoded({ extended: true }));

// cookie-parser用于解析Cookie
app.use(cookieParser());

// 配置静态文件服务
// 提供上传图片的访问路径
// /uploads/images/filename.jpg 映射到 backend/uploads/images/filename.jpg
app.use('/uploads/images', express.static('uploads/images'));

// 注册API路由
// 将所有/api开头的请求路由到routes模块处理
// 例如：GET /api/channels会被routes/index.ts处理
app.use('/api', routes);

// 健康检查端点
// 用于监控服务器状态，通常被监控系统调用
// 返回200 OK和简单的状态信息
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// 根端点
// 提供API的基本信息，便于开发者了解API
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Chat Application Backend API',
    version: '1.0.0',
    api_endpoints: 'http://localhost:3001/api',
    health_check: 'http://localhost:3001/health',
    socket_io: 'http://localhost:3001'
  });
});

// 初始化Socket.io服务器
// 创建Socket.io实例，传入HTTP服务器
// 配置CORS，允许WebSocket连接
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // 允许没有 origin 的请求 (如移动端)
      if (!origin) return callback(null, true);
      
      // 允许任何以 .vercel.app 结尾的域名、localhost 以及你的 Railway 域名
      if (origin.endsWith('.vercel.app') || origin.includes('localhost') || origin.includes('railway.app')) {
        callback(null, true);
      } else {
        console.error('CORS 拒绝了来源:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // 必须为 true，因为前端带了 Cookie
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
  }
});

// 应用Socket.io认证中间件
// 确保所有Socket连接都经过JWT验证
import { socketAuthMiddleware } from './security/socket-auth';
socketAuthMiddleware(io);

// 配置Socket.io的Redis适配器
// 支持多服务器水平扩展
import { configureSocketAdapter } from './performance/socket-adapter';
configureSocketAdapter(io);

// 将io实例注册到Express app中，方便控制器使用
app.set('io', io);

// Socket.io事件处理
// 初始化消息服务实例，用于处理消息相关逻辑
const messageService = new MessageService();

// 导入在线状态管理模块
import { onlineStatusManager } from './performance/online-status';

// 监听新的Socket.io连接
// 当有客户端连接到服务器时触发
io.on('connection', (socket) => {
  const { userId, username } = socket.data.user;
  console.log('User connected:', socket.id, 'User:', { userId, username });  // 打印连接的客户端ID和用户信息

  // 设置用户在线状态
  onlineStatusManager.setUserOnline(userId, username);

  // 监听客户端加入频道事件
  socket.on('join-channel', async (channelId: number) => {
    // 将客户端加入指定频道
    socket.join(`channel-${channelId}`);
    // 将用户添加到频道的成员列表
    await onlineStatusManager.addUserToChannel(userId, channelId);
    // 获取频道的在线成员
    const onlineMembers = await onlineStatusManager.getChannelOnlineMembers(channelId);
    // 广播用户加入通知
    io.to(`channel-${channelId}`).emit('user:joined', {
      userId,
      username,
      channelId,
      onlineMembers
    });
    // 打印客户端加入频道的日志
    console.log(`User ${username} (${userId}) joined channel ${channelId}`);
  });

  // 监听客户端离开频道事件
  socket.on('leave-channel', async (channelId: number) => {
    // 将客户端从指定频道移除
    socket.leave(`channel-${channelId}`);
    // 将用户从频道的成员列表中移除
    await onlineStatusManager.removeUserFromChannel(userId, channelId);
    // 获取频道的在线成员
    const onlineMembers = await onlineStatusManager.getChannelOnlineMembers(channelId);
    // 广播用户离开通知
    io.to(`channel-${channelId}`).emit('user:left', {
      userId,
      username,
      channelId,
      onlineMembers
    });
    // 打印客户端离开频道的日志
    console.log(`User ${username} (${userId}) left channel ${channelId}`);
  });

  // 监听客户端发送消息事件
  socket.on('send-message', async (data: { channelId: number; content: string; senderId: number }) => {
    try {
      // 调用消息服务创建新消息
      const newMessage = await messageService.createMessage({
        content: data.content,      // 消息内容
        senderId: data.senderId,    // 发送者ID
        channelId: data.channelId   // 频道ID
      });

      // 广播消息到指定频道
      // 使用io.to()方法将消息发送给频道中的所有客户端
      io.to(`channel-${data.channelId}`).emit('message:create', newMessage);
      // 打印消息发送日志
      console.log(`Message sent to channel ${data.channelId}: ${data.content}`);
    } catch (error) {
      // 捕获并打印错误
      console.error('Error creating message:', error);
      // 向发送者发送错误信息
      socket.emit('message:error', { message: 'Failed to send message' });
    }
  });

  // 语音通话事件处理
  // 加入语音频道
  socket.on('voice:join', (data: { channelId: number; userId: number }) => {
    try {
      // 将客户端加入语音频道房间
      socket.join(`voice-channel-${data.channelId}`);
      
      // 广播用户加入通知
      socket.to(`voice-channel-${data.channelId}`).emit('voice:user-joined', {
        userId: data.userId,
        channelId: data.channelId
      });
      
      console.log(`User ${data.userId} joined voice channel ${data.channelId}`);
    } catch (error) {
      console.error('Error joining voice channel:', error);
      socket.emit('voice:error', { message: 'Failed to join voice channel' });
    }
  });

  // 离开语音频道
  socket.on('voice:leave', (data: { channelId: number; userId: number }) => {
    try {
      // 将客户端从语音频道房间移除
      socket.leave(`voice-channel-${data.channelId}`);
      
      // 广播用户离开通知
      socket.to(`voice-channel-${data.channelId}`).emit('voice:user-left', {
        userId: data.userId,
        channelId: data.channelId
      });
      
      console.log(`User ${data.userId} left voice channel ${data.channelId}`);
    } catch (error) {
      console.error('Error leaving voice channel:', error);
      socket.emit('voice:error', { message: 'Failed to leave voice channel' });
    }
  });

  // 转发WebRTC信令消息
  socket.on('voice:signal', (data: { channelId: number; type: string; offer?: any; answer?: any; candidate?: any; senderId?: number }) => {
    try {
      // 从数据中获取发送者ID，如果没有则使用默认值
      const senderId = data.senderId || 0;
      const channelId = data.channelId || 0;
      
      console.log(`收到信令: 从用户 ${senderId} 发送，类型: ${data.type}，频道: ${channelId}`);
      
      // 如果有channelId，发送到指定频道
      if (channelId > 0) {
        console.log(`转发信令到频道 ${channelId}`);
        socket.to(`voice-channel-${channelId}`).emit('voice:signal', {
          ...data,
          senderId: senderId // 设置发送者ID
        });
      } else {
        // 简化版：广播到所有客户端，让客户端自己处理
        console.log(`广播信令到所有客户端`);
        io.emit('voice:signal', {
          ...data,
          senderId: senderId // 设置发送者ID
        });
      }
      
    } catch (error) {
      console.error('Error relaying WebRTC signal:', error);
      socket.emit('voice:error', { message: 'Failed to relay WebRTC signal' });
    }
  });

  // 处理webrtc_message事件（兼容新的实现）
  socket.on('webrtc_message', (data: { roomID: string; type: string; content: any }) => {
    try {
      console.log(`收到webrtc_message: 类型: ${data.type}，房间: ${data.roomID}`);
      
      // 转发消息到指定房间的其他用户
      socket.to(data.roomID).emit('webrtc_message', {
        sender: socket.id,
        type: data.type,
        content: data.content
      });
      
    } catch (error) {
      console.error('Error relaying WebRTC message:', error);
      socket.emit('voice:error', { message: 'Failed to relay WebRTC message' });
    }
  });

  // 广播语音频道状态
  socket.on('voice:status-update', (data: { channelId: number; status: 'join' | 'leave' | 'mute' | 'unmute'; userId: number }) => {
    try {
      // 广播状态更新到频道
      socket.to(`voice-channel-${data.channelId}`).emit('voice:status-updated', {
        userId: data.userId,
        status: data.status,
        channelId: data.channelId
      });
      
      console.log(`Broadcasted voice status update to channel ${data.channelId}: ${data.status} by user ${data.userId}`);
    } catch (error) {
      console.error('Error broadcasting voice status update:', error);
      socket.emit('voice:error', { message: 'Failed to broadcast voice status update' });
    }
  });

  // 监听客户端断开连接事件
  socket.on('disconnect', async () => {
    // 设置用户离线状态
    await onlineStatusManager.setUserOffline(userId);
    // 打印客户端断开连接的日志
    console.log('User disconnected:', socket.id, 'User:', { userId, username });
  });
});

// 启动服务器
// 从配置中获取端口，默认为3001
const PORT = config.port;

// 调用server.listen()方法启动服务器
server.listen(PORT, () => {
  // 服务器启动成功后打印日志
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`API endpoints available at http://localhost:${PORT}/api`);
  console.log(`Socket.io running on http://localhost:${PORT}`);
});

// 处理未捕获的Promise拒绝
// 当Promise被拒绝但没有被catch处理时触发
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  // 退出进程，状态码为1表示错误
  process.exit(1);
});

// 启动RabbitMQ消息消费者
// 在应用启动时启动消费者，处理队列中的消息
import { messageQueue } from './reliability/message-queue';
messageQueue.startConsumer().catch(error => {
  console.error('Error starting message consumer:', error);
});

// 处理未捕获的异常
// 当JavaScript异常没有被try-catch捕获时触发
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // 退出进程，状态码为1表示错误
  process.exit(1);
});