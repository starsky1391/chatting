# Docker 部署指南

本文档描述当前 Go 后端版本的 Docker 部署方式。项目根目录是 Compose 工作目录，所有命令默认在项目根目录执行。

## 服务组成

| 服务 | 镜像/构建 | 默认端口 | 说明 |
| --- | --- | --- | --- |
| nginx | `nginx:alpine` | 8080 / 8443 | 统一入口，代理前端、API、WebSocket、上传文件和 LiveKit |
| frontend | 本地构建 | 容器内 3000 | Next.js 前端 |
| backend | 本地构建 | 3001 | Go API、WebSocket、演示 seed 命令 |
| postgres | `postgres:16-alpine` | 5432 | 主数据库 |
| redis | `redis:7-alpine` | 6379 | 在线状态、活跃成员、辅助缓存 |
| kafka | `redpandadata/redpanda:v24.2.8` | 19092 / 9644 | Kafka 兼容事件总线 |
| livekit | `livekit/livekit-server` | 7880 / UDP 50000-50200 | 语音频道服务 |

## 环境要求

- Docker 20.10+
- Docker Compose plugin 2.x+
- 建议 4GB 以上内存
- 建议至少 10GB 可用磁盘，演示和上传图片越多需要越多空间

## 环境变量

复制根目录环境模板：

```bash
cp .env.example .env
```

重点修改：

```env
DB_USERNAME=postgres
DB_PASSWORD=change-this-db-password
DB_NAME=chat_app

REDIS_PASSWORD=change-this-redis-password

JWT_SECRET=change-this-long-random-secret

ADMIN_EMAIL=admin@example.com
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-this-admin-password

NGINX_HTTP_PORT=8080
NGINX_HTTPS_PORT=8443
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_SOCKET_URL=
```

生成随机密钥：

```bash
openssl rand -base64 48
```

## 一键部署

完整部署脚本：

```bash
chmod +x deploy.sh
./deploy.sh
```

快速部署脚本：

```bash
chmod +x deploy-quick.sh
./deploy-quick.sh
```

脚本会检查 Docker、创建 `.env`、构建镜像、启动服务并输出访问地址。脚本文件已通过 `.gitattributes` 固定为 LF，上传服务器后一般不需要再手动 `dos2unix`。

## 手动部署

```bash
docker compose build
docker compose up -d
docker compose ps
```

访问：

- HTTP: `http://服务器IP:8080`
- HTTPS: `https://服务器IP:8443`

如果浏览器提示自签名证书不安全，开发/演示环境可以继续访问；生产环境应替换为正式证书。

## 按服务更新

日常开发不要无脑全量 build。按变更范围构建：

```bash
# 后端代码、模型、路由、seed 命令变更
docker compose build backend
docker compose up -d backend

# 前端代码变更
docker compose build frontend
docker compose up -d frontend nginx

# Nginx 配置变更
docker compose up -d nginx

# LiveKit 配置变更
docker compose up -d livekit
```

查看状态：

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f nginx
```

## 清理策略

Compose 管理的数据保存在 volumes 中：

- `postgres_data`：数据库
- `redis_data`：Redis
- `backend_uploads`：上传图片和演示 seed 图片
- `nginx_logs`：Nginx 日志

清镜像和构建缓存不会删除这些业务数据：

```bash
docker compose down --rmi all
docker image prune -f
docker builder prune -f
docker compose up --build -d
```

如果要连数据库、上传图片也一起删掉，才使用：

```bash
docker compose down -v
```

不要手动删除 `/var/lib/docker/overlay2`。这会破坏 Docker 存储层元数据，后续 build 可能出现 `failed to prepare sha256... no such file or directory`。如果已经误删，应停止 Docker 后使用 Docker 官方命令或重装 Docker 存储目录处理。

## 演示数据

后端镜像内置 `seed-demo`：

```bash
docker compose exec backend ./seed-demo
```

它会创建：

- `foya@example.com` / `123456`
- group `test`
- 100 个 group 成员
- `general` 频道 128 条消息，包含图片
- `voice-demo` 语音频道
- 5 个私信会话

该命令可重复运行。它会重建演示消息，不会清理其他 group 的真实业务数据。

## 管理员账号

后端启动时会根据环境变量初始化管理员账号：

```env
ADMIN_EMAIL=admin@example.com
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-this-admin-password
```

登录该账号后可进入 `/admin`。生产环境必须修改默认管理员密码。

## LiveKit 语音频道

需要开放：

- TCP `7880`
- UDP `50000-50200`
- Nginx HTTP/HTTPS 端口：默认 `8080`、`8443`

前端通过 Nginx `/livekit/` 代理连接 LiveKit。公网部署时，安全组和防火墙必须放行以上端口，否则会出现语音频道无法加入、WebSocket 连接失败或 CORS/404 类错误。

## 常见命令

```bash
# 服务状态
docker compose ps

# 后端日志
docker compose logs -f backend

# Nginx 日志
docker compose logs -f nginx

# Kafka/Redpanda 日志
docker compose logs -f kafka

# 数据库 shell
docker compose exec postgres psql -U postgres -d chat_app

# 进入后端容器
docker compose exec backend sh

# 查看资源占用
docker compose stats

# 停止服务但保留数据
docker compose down

# 删除容器、网络和数据卷
docker compose down -v
```

## 备份和恢复

备份数据库：

```bash
docker compose exec -T postgres pg_dump -U postgres chat_app > backup.sql
```

恢复数据库：

```bash
cat backup.sql | docker compose exec -T postgres psql -U postgres chat_app
```

备份上传文件：

```bash
docker run --rm -v chatting_backend_uploads:/data -v "$PWD":/backup alpine tar czf /backup/backend_uploads.tar.gz -C /data .
```

恢复上传文件：

```bash
docker run --rm -v chatting_backend_uploads:/data -v "$PWD":/backup alpine sh -c "cd /data && tar xzf /backup/backend_uploads.tar.gz"
```

## 故障排查

### API 502

通常是后端容器未健康或 Nginx 解析不到 `backend`：

```bash
docker compose ps
docker compose logs backend --tail=200
docker compose logs nginx --tail=200
```

如果后端反复重启，优先看数据库密码、Redis 密码和 Kafka 是否健康。

### 后端数据库认证失败

确认 `.env` 中 `DB_PASSWORD` 与已有 `postgres_data` volume 初始化时的密码一致。PostgreSQL volume 已存在时，修改 `.env` 不会自动改数据库内部密码。

### 脚本无法执行

如果服务器上出现：

```text
bash: ./deploy.sh: cannot execute: required file not found
```

通常是 CRLF 换行导致。当前仓库用 `.gitattributes` 固定 `.sh` 为 LF；如果仍出问题，可执行：

```bash
sed -i 's/\r$//' deploy.sh deploy-quick.sh regen-lockfiles.sh
chmod +x deploy.sh deploy-quick.sh regen-lockfiles.sh
```

### Docker Hub 拉取超时

可以切换镜像源、重试或先单独拉取基础镜像：

```bash
docker compose pull postgres redis nginx livekit kafka
docker compose build backend frontend
docker compose up -d
```

