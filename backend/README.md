# 聊天应用后端

使用 Express、TypeScript 和 Socket.io 构建的聊天应用后端。

## 功能

- JWT 用户认证
- 频道管理
- 消息处理
- Socket.io 实时通信
- MVC 架构
- TypeScript 支持
- CORS 配置

## 项目结构

```
├── src/
│   ├── config/          # 配置文件
│   ├── controllers/     # 请求处理器
│   ├── middleware/      # Express 中间件
│   ├── models/          # 数据模型
│   ├── routes/          # API 路由
│   ├── services/        # 业务逻辑
│   ├── utils/           # 工具函数
│   └── index.ts         # 应用入口点
├── package.json         # 依赖和脚本
├── tsconfig.json        # TypeScript 配置
├── .eslintrc.json       # ESLint 配置
└── README.md           # 本文件
```

## 安装

1. 安装依赖：

```bash
npm install
```

## 开发

启动开发服务器（热重载）：

```bash
npm run dev
```

服务器将运行在 http://localhost:3001

## 构建

构建生产版本：

```bash
npm run build
```

## 生产环境

启动生产服务器：

```bash
npm start
```

## API 端点

### 认证

- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册

### 用户

- `GET /api/users/me` - 获取当前用户信息

### 频道

- `GET /api/channels` - 获取所有频道
- `GET /api/channels/:id` - 根据 ID 获取频道
- `POST /api/channels` - 创建新频道
- `GET /api/channels/:id/members` - 获取频道成员

### 消息

- `GET /api/channels/:id/messages` - 根据频道 ID 获取消息
- `POST /api/channels/:id/messages` - 创建新消息

## Socket.io 事件

### 客户端到服务器

- `join-channel` - 加入频道
- `leave-channel` - 离开频道
- `send-message` - 向频道发送消息

### 服务器到客户端

- `message:create` - 新消息创建

## 响应格式

所有 API 响应遵循以下格式：

```json
{
  "code": 200,
  "data": {},
  "msg": "success"
}
```

- `code` - HTTP 状态码
- `data` - 响应数据
- `msg` - 响应消息

## 环境变量

- `PORT` - 服务器端口（默认：3001）
- `JWT_SECRET` - JWT 密钥（默认：'your-secret-key'）
- `JWT_EXPIRES_IN` - JWT 过期时间（默认：'7d'）
- `CORS_ORIGIN` - CORS 来源（默认：'*'）

## 许可证

MIT
