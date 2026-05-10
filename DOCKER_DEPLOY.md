# Docker 部署指南

## 国内镜像加速

本项目已配置国内镜像源，包括：

- **Docker Hub 镜像**: `docker.1ms.run`, `docker.xuanyuan.me`
- **NPM 镜像**: `registry.npmmirror.com`
- **Go 模块代理**: `goproxy.cn`
- **Alpine 软件源**: `mirrors.aliyun.com`

## 快速开始

### 方式一：一键部署脚本

```bash
# 下载并运行部署脚本
chmod +x deploy.sh
./deploy.sh
```

### 方式二：快速部署

```bash
# 快速部署（适用于 Docker 已安装的情况）
chmod +x deploy-quick.sh
./deploy-quick.sh
```

### 方式三：使用 Makefile

```bash
# 查看所有命令
make help

# 完整部署
make deploy

# 启动服务
make start

# 停止服务
make stop

# 查看日志
make logs
make logs service=backend
```

### 方式四：手动部署

```bash
# 1. 创建环境文件
cp .env.example .env
# 编辑 .env 文件，设置密码等配置

# 2. 配置 Docker 镜像加速（国内用户）
sudo mkdir -p /etc/docker
sudo cp docker/daemon.json /etc/docker/daemon.json
sudo systemctl restart docker

# 3. 构建镜像
docker compose build

# 4. 启动服务
docker compose up -d

# 5. 查看状态
docker compose ps

# 6. 查看日志
docker compose logs -f
```

## 环境要求

- Docker 20.10+
- Docker Compose 2.0+
- 至少 4GB 可用内存
- 至少 10GB 磁盘空间

## 服务说明

| 服务 | 端口 | 说明 |
|------|------|------|
| Nginx | 8080/8443 | 反向代理 |
| Frontend | 3000 | Next.js 前端 |
| Backend | 3001 | Node.js 后端 |
| PostgreSQL | 5432 | 数据库 |
| Redis | 6379 | 缓存 |
| RabbitMQ | 5672/15672 | 消息队列 |

## 常用命令

```bash
# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f
docker compose logs -f backend
docker compose logs -f frontend

# 重启服务
docker compose restart

# 停止服务
docker compose down

# 完全清理（包括数据）
docker compose down -v

# 进入容器
docker compose exec backend sh
docker compose exec postgres psql -U postgres -d chat_app

# 查看资源使用
docker compose stats
```

## 生产环境配置

### 1. 修改默认密码

编辑 `.env` 文件，设置强密码：

```bash
# 生成随机密码
openssl rand -base64 24

# 生成 JWT 密钥
openssl rand -base64 48
```

### 2. 配置 HTTPS

将 SSL 证书放到 `docker/nginx/ssl/` 目录，并修改 Nginx 配置。

### 3. 限制端口暴露

生产环境中，可以移除不必要的端口映射，只暴露 Nginx 端口。

### 4. 配置 CORS

```env
CORS_ORIGIN=https://yourdomain.com
```

### 5. 资源限制

已在 `docker-compose.yml` 中配置了资源限制，可根据实际情况调整。

## 故障排除

### 服务无法启动

```bash
# 查看详细日志
docker compose logs

# 检查容器状态
docker compose ps

# 检查网络
docker network ls
docker network inspect chatting-network
```

### 数据库连接失败

```bash
# 检查数据库状态
docker compose ps postgres

# 查看数据库日志
docker compose logs postgres

# 进入数据库
docker compose exec postgres psql -U postgres
```

### 内存不足

```bash
# 查看资源使用
docker compose stats

# 清理未使用的资源
docker system prune -a
```

## 更新应用

```bash
# 方式一：使用脚本
./deploy.sh update

# 方式二：使用 Makefile
make update

# 方式三：手动
git pull
docker compose build --no-cache
docker compose down
docker compose up -d
```

## 备份与恢复

### 备份数据库

```bash
docker compose exec postgres pg_dump -U postgres chat_app > backup.sql
```

### 恢复数据库

```bash
cat backup.sql | docker compose exec -T postgres psql -U postgres chat_app
```

### 备份所有数据

```bash
# 创建备份目录
mkdir -p backup

# 备份 volumes
docker run --rm -v chatting_postgres_data:/data -v $(pwd)/backup:/backup alpine tar czf /backup/postgres.tar.gz /data
docker run --rm -v chatting_redis_data:/data -v $(pwd)/backup:/backup alpine tar czf /backup/redis.tar.gz /data
```
