# 实时聊天应用

一个基于 Go、React 和 LiveKit 的实时聊天应用，支持文字消息和语音通话功能。

## 技术栈

### 后端
- **Go** - 高性能编程语言
- **Gin** - Web 框架
- **GORM** - ORM 框架
- **PostgreSQL** - 关系型数据库
- **Socket.io (go-socket.io)** - 实时通信
- **LiveKit** - 实时音视频
- **JWT** - 认证机制

### 前端
- **Next.js 14** - React 框架
- **TypeScript** - 类型安全
- **Tailwind CSS** - 样式框架
- **Zustand** - 状态管理
- **Socket.io Client** - 实时通信
- **LiveKit Components** - 音视频通话

## 核心功能

- ✅ 用户注册与登录
- ✅ 实时消息发送
- ✅ 频道管理
- ✅ 成员列表
- ✅ 响应式设计
- ✅ 消息历史记录
- ✅ 用户状态显示
- ✅ 语音通话房间 (LiveKit)

## 快速开始

### 使用 Docker Compose（推荐）

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd chatting
   ```

2. **配置环境变量**
   创建 `backend-go/.env` 文件：
   ```env
   DB_HOST=postgres
   DB_USER=postgres
   DB_PASSWORD=your_password
   DB_NAME=chatapp
   DB_PORT=5432
   JWT_SECRET=your_jwt_secret
   LIVEKIT_API_KEY=devkey
   LIVEKIT_API_SECRET=secret
   ```

3. **启动服务**
   ```bash
   docker-compose up -d
   ```

4. **访问应用**
   - 前端: https://localhost:8443
   - 后端 API: https://localhost:8443/api

### 本地开发

#### 后端

1. **进入后端目录**
   ```bash
   cd backend-go
   ```

2. **安装依赖**
   ```bash
   go mod download
   ```

3. **配置环境变量**
   ```bash
   cp .env.example .env
   ```

4. **启动服务**
   ```bash
   go run cmd/server/main.go
   ```

#### 前端

1. **进入前端目录**
   ```bash
   cd frontend
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动开发服务器**
   ```bash
   npm run dev
   ```

## 项目结构

```
chatting/
├── backend-go/           # Go 后端
│   ├── cmd/              # 应用入口
│   ├── internal/
│   │   ├── config/       # 配置
│   │   ├── controller/   # 控制器
│   │   ├── middleware/   # 中间件
│   │   ├── model/        # 数据模型
│   │   ├── router/       # 路由
│   │   ├── service/      # 业务逻辑
│   │   ├── socket/       # WebSocket 处理
│   │   └── livekit/      # LiveKit 服务
│   └── go.mod
├── frontend/             # Next.js 前端
│   ├── src/
│   │   ├── app/          # 页面
│   │   ├── components/   # 组件
│   │   ├── store/        # 状态管理
│   │   └── lib/          # 工具函数
│   └── package.json
├── docker/               # Docker 配置
│   ├── nginx/            # Nginx 配置
│   └── livekit.yaml      # LiveKit 配置
└── docker-compose.yml    # Docker Compose 配置
```

## Docker 部署

详细部署说明请参考 [DOCKER_DEPLOY.md](./DOCKER_DEPLOY.md)

### 服务说明

| 服务 | 端口 | 说明 |
|------|------|------|
| nginx | 80, 8443 | 反向代理 (HTTPS 在 8443) |
| frontend | 3000 | Next.js 应用 |
| backend | 8080 | Go API 服务 |
| postgres | 5432 | PostgreSQL 数据库 |
| livekit | 7880, 7881, 50000-50200/udp | LiveKit 音视频服务 |

## API 文档

API 文档位于 `api-docs.json` 文件，使用 OpenAPI 3.1.0 格式。

## 开发命令

### 后端 (Go)
```bash
go run cmd/server/main.go    # 启动开发服务器
go build -o bin/server       # 构建生产版本
go test ./...                # 运行测试
```

### 前端
```bash
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npm run start        # 启动生产服务器
npm run lint         # 代码检查
```

## 常见问题

### Q: 如何查看数据库？
A: 可以使用 DBeaver、pgAdmin 或其他 PostgreSQL 客户端连接到数据库。

### Q: HTTPS 证书问题？
A: 项目使用自签名证书，浏览器会提示不安全，点击继续访问即可。

### Q: LiveKit 语音通话无法连接？
A: 确保防火墙开放了 UDP 端口 50000-50200，并检查 nginx 配置中的 Host header 是否正确传递端口。

## 许可证

MIT License
