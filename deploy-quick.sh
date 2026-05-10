#!/bin/bash

# ============================================
# Chat Application (Go Backend) - Quick Deploy Script
# ============================================
# Usage: curl -fsSL https://your-domain/deploy-quick.sh | bash
# ============================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "============================================"
echo "  Chat Application - Quick Deploy"
echo "============================================"
echo -e "${NC}"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}Docker is not installed. Installing...${NC}"
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    echo -e "${GREEN}Docker installed. Please log out and back in.${NC}"
    exit 0
fi

# Check Docker Compose
if ! docker compose version &> /dev/null; then
    echo -e "${RED}Docker Compose is not available. Please install Docker with Compose plugin.${NC}"
    exit 1
fi

# Create .env if not exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file...${NC}"

    DB_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
    REDIS_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
    RABBITMQ_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
    JWT_SECRET=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 48)

    cat > .env << EOF
# Database
DB_USERNAME=postgres
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=chat_app
DB_PORT=5432

# Redis
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_PORT=6379

# RabbitMQ
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=${RABBITMQ_PASSWORD}
RABBITMQ_VHOST=/
RABBITMQ_PORT=5672
RABBITMQ_MGMT_PORT=15672

# JWT
JWT_SECRET=${JWT_SECRET}
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=*

# Ports
BACKEND_PORT=3001
NGINX_HTTP_PORT=8080
NGINX_HTTPS_PORT=8443

# Frontend
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_SOCKET_URL=
EOF

    echo -e "${GREEN}.env file created with secure passwords${NC}"
fi

# Build and start
echo -e "${YELLOW}Building Docker images...${NC}"
docker compose build

echo -e "${YELLOW}Starting services...${NC}"
docker compose up -d

echo -e "${YELLOW}Waiting for services to start...${NC}"
sleep 15

# Show status
echo ""
echo -e "${GREEN}============================================"
echo "  Deployment Complete!"
echo "============================================${NC}"
echo ""
docker compose ps
echo ""
echo -e "${BLUE}Access your application at:${NC}"
echo -e "  HTTP:  ${GREEN}http://localhost:8080${NC}"
echo -e "  HTTPS: ${GREEN}https://localhost:8443${NC}"
echo ""
echo -e "${YELLOW}RabbitMQ Management:${NC}"
echo -e "  ${GREEN}http://localhost:15672${NC}"
echo ""
echo -e "${YELLOW}Useful commands:${NC}"
echo "  Logs:   docker compose logs -f"
echo "  Stop:   docker compose down"
echo "  Restart: docker compose restart"
