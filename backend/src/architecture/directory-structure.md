# 目录结构设计

## 根目录结构

```
backend/
├── src/
│   ├── config/             # 配置管理模块
│   │   ├── index.ts        # 中央配置文件
│   │   ├── database.ts     # 数据库配置
│   │   ├── redis.ts        # Redis配置
│   │   └── rabbitmq.ts     # RabbitMQ配置
│   ├── security/           # 安全模块
│   │   ├── index.ts        # 安全模块入口
│   │   ├── jwt.ts          # JWT工具类
│   │   ├── middleware.ts   # 认证中间件
│   │   └── socket-auth.ts  # Socket.io认证中间件
│   ├── performance/        # 性能模块
│   │   ├── index.ts        # 性能模块入口
│   │   ├── redis-client.ts # Redis客户端
│   │   ├── online-status.ts # 在线状态管理
│   │   └── socket-adapter.ts # Socket.io适配器配置
│   ├── data/               # 数据模块
│   │   ├── index.ts        # 数据模块入口
│   │   ├── models/         # 数据库模型
│   │   │   ├── User.ts     # 用户模型
│   │   │   ├── Message.ts  # 消息模型
│   │   │   ├── Channel.ts  # 频道模型
│   │   │   └── UserChannel.ts # 用户频道关联模型
│   │   ├── repositories/   # 数据访问层
│   │   │   ├── UserRepository.ts
│   │   │   ├── MessageRepository.ts
│   │   │   └── ChannelRepository.ts
│   │   └── services/       # 业务逻辑层
│   │       ├── AuthService.ts
│   │       ├── MessageService.ts
│   │       └── ChannelService.ts
│   ├── reliability/        # 可靠性模块
│   │   ├── index.ts        # 可靠性模块入口
│   │   ├── rabbitmq-client.ts # RabbitMQ客户端
│   │   ├── message-queue.ts # 消息队列处理
│   │   └── worker.ts       # 消息消费者
│   ├── controllers/        # 控制器层
│   │   ├── AuthController.ts
│   │   ├── MessageController.ts
│   │   ├── ChannelController.ts
│   │   └── UploadController.ts
│   ├── routes/             # 路由配置
│   │   └── index.ts
│   ├── utils/              # 工具类
│   │   ├── response.ts     # 响应工具
│   │   └── validation.ts   # 验证工具
│   ├── socket/             # Socket.io处理
│   │   ├── index.ts        # Socket.io入口
│   │   ├── handlers/       # 事件处理器
│   │   │   ├── message.ts  # 消息事件处理
│   │   │   └── voice.ts    # 语音事件处理
│   │   └── middleware/     # Socket中间件
│   ├── types/              # TypeScript类型定义
│   │   └── index.ts
│   └── index.ts            # 应用入口
├── .env.example            # 环境变量示例
├── package.json            # 依赖配置
└── tsconfig.json           # TypeScript配置
```

## 模块说明

### 1. 配置管理模块 (config/)
- 中央配置文件，统一管理环境变量
- 数据库、Redis、RabbitMQ等服务的配置
- 敏感信息从.env文件加载

### 2. 安全模块 (security/)
- JWT 双Token认证机制
- 认证中间件
- Socket.io连接鉴权

### 3. 性能模块 (performance/)
- Redis客户端管理
- 在线状态跟踪
- Socket.io Redis适配器配置

### 4. 数据模块 (data/)
- 数据库模型定义
- 数据访问层（Repository）
- 业务逻辑层（Service）

### 5. 可靠性模块 (reliability/)
- RabbitMQ客户端管理
- 消息队列处理
- 异步消息消费者

### 6. 控制器层 (controllers/)
- HTTP请求处理
- 业务逻辑调用
- 响应返回

### 7. 路由配置 (routes/)
- API路由定义
- 中间件应用

### 8. Socket处理 (socket/)
- Socket.io初始化
- 事件处理器
- 中间件

## 依赖关系

1. **配置管理模块** → 所有其他模块
2. **安全模块** → 控制器、Socket处理
3. **性能模块** → Socket处理、数据模块
4. **数据模块** → 控制器、可靠性模块
5. **可靠性模块** → Socket处理
6. **控制器** → 数据模块、安全模块
7. **Socket处理** → 安全模块、性能模块、可靠性模块

## 关键文件说明

### 安全模块
- `security/jwt.ts`: 实现双Token认证机制，生成accessToken和refreshToken
- `security/socket-auth.ts`: Socket.io连接鉴权中间件

### 性能模块
- `performance/online-status.ts`: 基于Redis的在线状态管理
- `performance/socket-adapter.ts`: Socket.io Redis适配器配置

### 数据模块
- `data/repositories/MessageRepository.ts`: 消息数据访问层，支持分页查询
- `data/services/MessageService.ts`: 消息业务逻辑层，集成RabbitMQ

### 可靠性模块
- `reliability/message-queue.ts`: 消息队列生产和消费
- `reliability/worker.ts`: 异步消息处理，写入数据库

### Socket处理
- `socket/handlers/message.ts`: 消息事件处理，集成消息队列
- `socket/middleware/auth.ts`: Socket连接认证中间件

## 扩展性考虑

1. **水平扩展**：通过Socket.io Redis适配器支持多服务器部署
2. **模块化设计**：各模块职责清晰，便于独立开发和测试
3. **配置管理**：环境变量分离，支持不同环境部署
4. **性能优化**：Redis缓存热点数据，减少数据库访问
5. **可靠性保障**：RabbitMQ消息队列确保数据不丢失

## 实施步骤

1. 首先创建目录结构
2. 实现配置管理模块
3. 实现安全模块（JWT双Token认证）
4. 实现Socket.io连接鉴权
5. 实现Redis实时状态管理
6. 实现RabbitMQ异步持久化
7. 重构数据模块，支持分页查询
8. 集成各模块，测试功能
9. 编写单元测试
10. 提供模块间数据流转文档