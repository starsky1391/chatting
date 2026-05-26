#!/bin/bash

# ============================================
# 重新生成 package-lock.json 使用镜像源
# 用于修复 Docker 构建时依赖下载失败的问题
# ============================================

set -e

echo "============================================"
echo "  重新生成 package-lock.json"
echo "============================================"
echo ""

# 检查 npm 是否存在
if ! command -v npm &> /dev/null; then
    echo "错误: npm 未安装"
    exit 1
fi

# 备份原始 lock 文件
BACKUP_DIR="./backup-lockfiles-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

if [ -f "./package-lock.json" ]; then
    cp ./package-lock.json "$BACKUP_DIR/"
    echo "✓ 已备份原始 package-lock.json 到 $BACKUP_DIR"
fi

# 设置镜像源
MIRROR=${1:-"https://registry.npmmirror.com"}
echo "✓ 使用镜像源: $MIRROR"

# 配置 npm
npm config set registry "$MIRROR"
npm config set fetch-retries 5
npm config set fetch-retry-factor 2
npm config set fetch-retry-mintimeout 20000
npm config set fetch-retry-maxtimeout 120000
npm config set maxsockets 10

echo ""
echo "正在清理旧的 node_modules 和 lock 文件..."

# 删除旧的 lock 和 modules（如果存在）
rm -rf node_modules package-lock.json

echo ""
echo "正在重新安装依赖（这可能需要几分钟）..."

# 安装依赖（这会生成新的 package-lock.json）
npm install --prefer-offline --no-audit

echo ""
echo "============================================"
echo "✓ package-lock.json 已重新生成！"
echo ""
echo "新生成的 lock 文件将使用镜像源地址:"
echo "  $MIRROR"
echo ""
echo "备份文件位置: $BACKUP_DIR/"
echo ""
echo "现在你可以尝试重新构建 Docker 镜像:"
echo "  docker compose build --no-cache backend"
echo "  docker compose build --no-cache frontend"
echo "============================================"
