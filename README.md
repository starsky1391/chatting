# 聊天应用项目

这是一个基于Node.js、React和Socket.io的实时聊天应用。

## 技术栈

### 后端
- **Node.js** - JavaScript运行时
- **Express** - Web框架
- **TypeScript** - 类型安全
- **Socket.io** - 实时通信
- **PostgreSQL** - 关系型数据库
- **Sequelize** - ORM框架
- **JWT** - 认证机制

### 前端
- **Next.js 14** - React框架
- **TypeScript** - 类型安全
- **Tailwind CSS** - 样式框架
- **Zustand** - 状态管理
- **Socket.io Client** - 实时通信

## 快速开始

### 前提条件
- Node.js 18+
- PostgreSQL 14+

### 后端安装与运行

1. **进入后端目录**
   ```bash
   cd backend
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **配置环境变量**
   ```bash
   cp .env.example .env
   ```
   - 修改 `.env` 文件中的数据库连接信息

4. **创建数据库**
   ```bash
   npm run db:create
   ```

5. **初始化数据库模型**
   ```bash
   npm run db:init
   ```

6. **启动开发服务器**
   ```bash
   npm run dev
   ```
   - 服务器将运行在 http://localhost:3001

### 前端安装与运行

1. **回到项目根目录**
   ```bash
   cd ..
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动开发服务器**
   ```bash
   npm run dev
   ```
   - 前端将运行在 http://localhost:3000

4. **访问应用**
   - 打开浏览器，访问 http://localhost:3000
   - 注册新用户或使用现有账号登录

## 项目结构

### 后端
```
backend/
├── src/
│   ├── config/          # 配置文件
│   ├── controllers/     # 控制器层
│   ├── middleware/       # 中间件
│   ├── models/           # 数据模型
│   ├── routes/           # API路由
│   ├── services/        # 业务逻辑
│   ├── utils/           # 工具函数
│   └── index.ts         # 应用入口
└── .env                 # 环境变量
```

### 前端
```
./
├── src/
│   ├── app/             # Next.js页面
│   ├── components/      # React组件
│   ├── hooks/           # 自定义钩子
│   ├── store/           # 状态管理
│   └── lib/             # 工具函数
└── package.json         # 项目依赖
```

## 核心功能

- ✅ 用户注册与登录
- ✅ 实时消息发送
- ✅ 频道管理
- ✅ 成员列表
- ✅ 响应式设计
- ✅ 消息历史记录
- ✅ 用户状态显示

## API文档

API文档位于 `api-docs.json` 文件，使用OpenAPI 3.1.0格式。

## 开发命令

### 后端
```bash
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npm run start        # 启动生产服务器
npm run lint         # 代码检查
npm run typecheck    # 类型检查
npm run db:create    # 创建数据库
npm run db:init      # 初始化数据库模型
```

### 前端
```bash
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npm run start        # 启动生产服务器
npm run lint         # 代码检查
npm run typecheck    # 类型检查
```

## 学习资源

对于Node.js萌新，以下资源可能对你有所帮助：

- [Node.js官方文档](https://nodejs.org/zh-cn/docs/)
- [Express官方文档](https://expressjs.com/zh-cn/)
- [TypeScript官方文档](https://www.typescriptlang.org/docs/)
- [Socket.io官方文档](https://socket.io/zh-CN/docs/v4/)
- [Next.js官方文档](https://nextjs.org/docs)

## 常见问题

### Q: 如何查看数据库？
A: 可以使用DBeaver、pgAdmin或其他PostgreSQL客户端连接到数据库。

### Q: 如何修改端口？
A: 修改 `.env` 文件中的 `PORT` 变量。

### Q: 如何添加新功能？
A: 建议按照以下步骤：
1. 在 `models/` 中创建数据模型
2. 在 `services/` 中实现业务逻辑
3. 在 `controllers/` 中添加API端点
4. 在 `routes/` 中注册路由
5. 在前端实现对应的UI组件

## 贡献

欢迎提交Issue和Pull Request！

## 许可证

MIT License
