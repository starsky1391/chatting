# 部署时依赖下载失败 - 故障排除指南

## 常见问题及解决方案

### 问题 1: NPM 依赖下载超时或失败

**症状**:
```
npm ERR! network timeout
npm ERR! request to https://registry.npmjs.org/... failed
```

**解决方案**:

#### 方案 A: 使用国内镜像源（推荐）

项目已配置 `npmmirror.com` 镜像，但有时该镜像可能不稳定。可以尝试其他镜像：

```bash
# 编辑 .env 文件
NPM_REGISTRY=https://registry.npmmirror.com   # 默认淘宝镜像
# 或尝试:
NPM_REGISTRY=https://mirrors.huaweicloud.com/repository/npm/  # 华为云
NPM_REGISTRY=https://registry.npmmirror.com   # 淘宝（备用）
```

#### 方案 B: 在服务器上重新生成 lock 文件

```bash
# 在本地或服务器上执行
cd backend
bash ../regen-lockfiles.sh https://registry.npmmirror.com

cd ../frontend
bash ../regen-lockfiles.sh https://registry.npmmirror.com
```

#### 方案 C: 手动重试构建

```bash
# 清除缓存后重新构建
docker compose build --no-cache backend frontend
```

---

### 问题 2: Docker 镜像拉取失败（Docker Hub 被墙）

**症状**:
```
Error response from daemon: pull access denied for node
```

**解决方案**:

配置 Docker Hub 国内加速器：

```bash
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json << 'EOF'
{
  "registry-mirrors": [
    "https://docker.1ms.run",
    "https://docker.xuanyuan.me",
    "https://docker.m.daocloud.io",
    "https://dockerpull.org"
  ]
}
EOF

sudo systemctl daemon-reload
sudo systemctl restart docker
```

或者运行项目的自动配置脚本：
```bash
./deploy.sh mirror
```

---

### 问题 3: 特定包下载失败（如 sharp、node-sass 等二进制包）

**症状**:
```
npm ERR! Error: EACCES: permission denied, mkdir '/app/node_modules/sharp'
npm ERR! command failed: ...
```

**解决方案**:

项目已配置了二进制包镜像源（见 `.npmrc`），但如果仍然失败：

```bash
# 方式一：增加构建资源
# 编辑 docker-compose.yml，增加 backend/frontend 的 memory limits

# 方式二：手动指定平台（ARM/x86 兼容问题）
docker compose build --platform linux/amd64 backend frontend

# 方式三：使用预编译的二进制包
export npm_config_sharp_binary_host="https://npmmirror.com/mirrors/sharp/"
export npm_config_sharp_libvips_binary_host="https://npmmirror.com/mirrors/sharp-libvips/"
docker compose build
```

---

### 问题 4: Alpine 包管理器 (apk) 失败

**症状**:
```
ERROR: unable to select packages: ... (no such package)
```

**解决方案**:

Dockerfile 已配置阿里云 Alpine 镜像源。如仍失败：

```bash
# 手动进入容器测试网络
docker run --rm -it node:20-alpine sh
# 在容器内执行：
cat /etc/apk/repositories
# 应该显示 mirrors.aliyun.com
apk update
```

---

### 问题 5: 构建内存不足

**症状**:
```
JavaScript heap out of memory
fatal error: CALL_AND_RETRY_LAST Allocation failed
```

**解决方案**:

```bash
# 增加 Node.js 内存限制
# 编辑 Dockerfile，在 RUN npm install 之前添加：
ENV NODE_OPTIONS="--max-old-space-size=4096"

# 或临时增加 Docker 构建资源
DOCKER_BUILDKIT=0 docker compose build backend frontend
```

---

## 快速诊断命令

### 1. 测试 NPM 连通性

```bash
# 测试镜像源速度
curl -o /dev/null -s -w "%{time_total}" https://registry.npmmirror.com/npm

# 对比官方源
curl -o /dev/null -s -w "%{time_total}" https://registry.npmjs.org/npm
```

### 2. 测试 Docker 连通性

```bash
# 测试 Docker Hub 加速器
docker pull hello-world
```

### 3. 查看详细构建日志

```bash
# 查看完整构建日志
DOCKER_BUILDKIT=0 docker compose build 2>&1 | tee build.log

# 分析失败点
grep -A 10 -B 5 "error\|failed\|ERR" build.log
```

### 4. 清理并重建

```bash
# 完全清理后重建
docker system prune -af
docker compose down -v
rm -rf backend/node_modules frontend/node_modules
docker compose build --no-cache
docker compose up -d
```

---

## 推荐的服务器环境配置

### 最小系统要求

- **操作系统**: Ubuntu 20.04+ / CentOS 8+ / Debian 11+
- **内存**: 至少 4GB RAM（建议 8GB+）
- **磁盘**: 至少 20GB 可用空间
- **Docker**: 20.10.0+

### 推荐的 DNS 设置

编辑 `/etc/resolv.conf`:
```bash
nameserver 8.8.8.8
nameserver 114.114.114.114
nameserver 223.5.5.5
```

### 推荐的 Docker 配置

`/etc/docker/daemon.json`:
```json
{
  "registry-mirrors": [
    "https://docker.1ms.run",
    "https://docker.xuanyuan.me"
  ],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m",
    "max-file": "3"
  },
  "storage-driver": "overlay2"
}
```

---

## 一键修复脚本

如果上述方法都不行，可以尝试一键修复：

```bash
#!/bin/bash
# save as fix-deploy.sh

echo "=== 1. 配置 Docker 镜像 ==="
./deploy.sh mirror || true

echo ""
echo "=== 2. 重新生成 Lock 文件 ==="
cd backend && bash ../regen-lockfiles.sh
cd ../frontend && bash ../regen-lockfiles.sh
cd ..

echo ""
echo "=== 3. 清理旧镜像 ==="
docker system prune -af

echo ""
echo "=== 4. 重新构建 ==="
docker compose build --no-cache

echo ""
echo "=== 5. 启动服务 ==="
docker compose up -d

echo ""
echo "完成！查看状态: docker compose ps"
```

运行方式：
```bash
chmod +x fix-deploy.sh
./fix-deploy.sh
```

---

## 如果仍然无法解决

请提供以下信息以便进一步排查：

1. **完整的错误日志** (`docker compose build 2>&1 | tee error.log`)
2. **服务器地区和网络环境** (是否在公司内网、是否有代理等)
3. **可用内存** (`free -h`)
4. **Docker 版本** (`docker --version`)
5. **操作系统信息** (`cat /etc/os-release`)
