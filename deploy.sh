#!/bin/bash

# ============================================
# Chat Application (Go Backend) - Linux Docker Deployment
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

TENCENT_COMPOSE_FILE="docker-compose.tencent.yml"
USE_TENCENT_COMPOSE=${USE_TENCENT_COMPOSE:-false}

# Run docker compose with optional Tencent Cloud build image overrides.
compose() {
    if [ "$USE_TENCENT_COMPOSE" = "true" ]; then
        if [ ! -f "$TENCENT_COMPOSE_FILE" ]; then
            print_error "$TENCENT_COMPOSE_FILE not found"
            exit 1
        fi
        docker compose -f docker-compose.yml -f "$TENCENT_COMPOSE_FILE" "$@"
    else
        docker compose "$@"
    fi
}

enable_tencent_compose() {
    USE_TENCENT_COMPOSE=true
    print_msg "Using Tencent Cloud Docker build image overrides" "$GREEN"
}

parse_global_options() {
    for arg in "$@"; do
        case "$arg" in
            --tencent|--tencent-cloud|--tencent-mirror)
                USE_TENCENT_COMPOSE=true
                ;;
        esac
    done
}

first_command_arg() {
    for arg in "$@"; do
        case "$arg" in
            --help|-h)
                echo "$arg"
                return 0
                ;;
            --*)
                ;;
            *)
                echo "$arg"
                return 0
                ;;
        esac
    done
}

get_env_value() {
    local key="$1"
    if [ -f .env ]; then
        grep -E "^${key}=" .env | tail -1 | cut -d= -f2-
    fi
}

wait_for_service_health() {
    local service="$1"
    local expected="$2"
    local attempts="${3:-30}"
    local delay="${4:-2}"

    local i=0
    while [ "$i" -lt "$attempts" ]; do
        local status=$(compose ps --format json "$service" 2>/dev/null | grep -o '"Health":"[^"]*"' | head -1 | cut -d'"' -f4)
        local state=$(compose ps --format json "$service" 2>/dev/null | grep -o '"State":"[^"]*"' | head -1 | cut -d'"' -f4)

        if [ "$expected" = "healthy" ] && [ "$status" = "healthy" ]; then
            return 0
        fi

        if [ "$expected" = "running" ] && [ "$state" = "running" ]; then
            return 0
        fi

        i=$((i + 1))
        sleep "$delay"
    done

    return 1
}

sync_postgres_password() {
    local db_user="${DB_USERNAME:-$(get_env_value DB_USERNAME)}"
    local db_name="${DB_NAME:-$(get_env_value DB_NAME)}"
    local db_password="${DB_PASSWORD:-$(get_env_value DB_PASSWORD)}"

    if [ -z "$db_user" ] || [ -z "$db_name" ] || [ -z "$db_password" ]; then
        print_warning "Skipping Postgres password sync because DB credentials are missing"
        return 0
    fi

    if ! compose ps postgres 2>/dev/null | grep -q "postgres"; then
        return 0
    fi

    print_msg "Syncing Postgres password with current .env..." "$YELLOW"

    if ! wait_for_service_health postgres healthy 30 2; then
        print_warning "Postgres is not healthy yet; skipping password sync"
        return 0
    fi

    compose exec -T -e DB_SYNC_PASSWORD="$db_password" postgres sh -lc '
        psql -U "'"$db_user"'" -d "'"$db_name"'" -v ON_ERROR_STOP=1 \
          -v db_sync_password="$DB_SYNC_PASSWORD" \
          -c "ALTER USER \"'"$db_user"'\" WITH PASSWORD :'"'"'db_sync_password'"'"';"
    ' >/dev/null

    print_success "Postgres password synced"
}

restart_backend_after_db_sync() {
    compose restart backend >/dev/null 2>&1 || true
}

# Print colored message
print_msg() {
    echo -e "${2}${1}${NC}"
}

# Print step
print_step() {
    echo ""
    print_msg "============================================" "$BLUE"
    print_msg "$1" "$BLUE"
    print_msg "============================================" "$BLUE"
    echo ""
}

# Print success
print_success() {
    print_msg "✓ $1" "$GREEN"
}

# Print error
print_error() {
    print_msg "✗ $1" "$RED"
}

# Print warning
print_warning() {
    print_msg "⚠ $1" "$YELLOW"
}

# Check if running as root
check_root() {
    : # 这是一个占位符，防止函数为空报错
    #if [ "$EUID" -eq 0 ]; then
    #    print_warning "Running as root is not recommended."
    #    print_msg "Please run as a regular user with sudo privileges." "$YELLOW"
    #    exit 1
    #fi
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Install Docker
install_docker() {
    print_step "Installing Docker"

    if command_exists docker; then
        print_success "Docker is already installed"
        docker --version
        return 0
    fi

    print_msg "Installing Docker..." "$YELLOW"

    # Detect OS
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
    else
        print_error "Cannot detect OS"
        exit 1
    fi

    case $OS in
        ubuntu|debian)
            sudo apt-get update
            sudo apt-get install -y ca-certificates curl gnupg
            sudo install -m 0755 -d /etc/apt/keyrings
            curl -fsSL https://download.docker.com/linux/$OS/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
            sudo chmod a+r /etc/apt/keyrings/docker.gpg
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
            sudo apt-get update
            sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            ;;
        centos|rhel|rocky|almalinux)
            sudo yum install -y yum-utils
            sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
            sudo yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            sudo systemctl start docker
            sudo systemctl enable docker
            ;;
        fedora)
            sudo dnf -y install dnf-plugins-core
            sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
            sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            sudo systemctl start docker
            sudo systemctl enable docker
            ;;
        *)
            print_error "Unsupported OS: $OS"
            print_msg "Please install Docker manually: https://docs.docker.com/engine/install/" "$YELLOW"
            exit 1
            ;;
    esac

    # Add user to docker group
    sudo usermod -aG docker $USER

    print_success "Docker installed successfully"
    print_warning "Please log out and log back in for group changes to take effect"
}

# Install Docker Compose (standalone, if needed)
install_docker_compose() {
    if command_exists docker-compose; then
        print_success "Docker Compose is already installed"
        docker-compose --version
        return 0
    fi

    # Docker Compose is now a plugin, check for it
    if docker compose version >/dev/null 2>&1; then
        print_success "Docker Compose plugin is installed"
        docker compose version
        return 0
    fi

    print_msg "Docker Compose not found, but it should be included with Docker" "$YELLOW"
}

# Configure Docker mirror for China
configure_docker_mirror() {
    print_step "Configuring Docker Mirror"

    if [ -f /etc/docker/daemon.json ]; then
        print_warning "Docker daemon.json already exists"
        read -p "Overwrite with China mirror config? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_msg "Keeping existing Docker config" "$YELLOW"
            return 0
        fi
    fi

    # Create docker directory
    sudo mkdir -p /etc/docker

    # Write daemon.json with China mirrors
    sudo tee /etc/docker/daemon.json > /dev/null << 'EOF'
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
  "storage-driver": "overlay2",
  "live-restore": true
}
EOF

    # Restart Docker to apply changes
    print_msg "Restarting Docker service..." "$YELLOW"
    sudo systemctl daemon-reload
    sudo systemctl restart docker

    print_success "Docker mirror configured"
    print_msg "Mirrors:" "$BLUE"
    print_msg "  - https://docker.1ms.run" "$BLUE"
    print_msg "  - https://docker.xuanyuan.me" "$BLUE"
}

# Check Docker service
check_docker_service() {
    print_step "Checking Docker Service"

    if ! sudo systemctl is-active --quiet docker; then
        print_msg "Starting Docker service..." "$YELLOW"
        sudo systemctl start docker
        sudo systemctl enable docker
    fi

    print_success "Docker service is running"
}

# Create environment file
create_env_file() {
    print_step "Creating Environment File"

    if [ -f .env ]; then
        print_warning ".env file already exists"
        read -p "Do you want to overwrite it? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_msg "Keeping existing .env file" "$YELLOW"
            return 0
        fi
    fi

    # Generate random passwords
    DB_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
    REDIS_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
    RABBITMQ_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
    JWT_SECRET=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 48)

    # Ask for NPM registry
    echo ""
    echo "Select NPM Registry:"
    echo "  [1] China Mirror (npmmirror.com) - Recommended for China"
    echo "  [2] Official (npmjs.org) - Use if mirror fails"
    read -p "Enter choice (1-2, default: 1): " registry_choice

    case $registry_choice in
        2)
            NPM_REGISTRY="https://registry.npmjs.org"
            print_msg "Using official NPM registry" "$YELLOW"
            ;;
        *)
            NPM_REGISTRY="https://registry.npmmirror.com"
            print_msg "Using China NPM mirror" "$GREEN"
            ;;
    esac

    cat > .env << EOF
# ============================================
# Chat Application Environment Configuration
# ============================================

# Database Configuration
DB_USERNAME=postgres
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=chat_app
DB_PORT=5432

# Redis Configuration
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_PORT=6379

# RabbitMQ Configuration
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=${RABBITMQ_PASSWORD}
RABBITMQ_VHOST=/
RABBITMQ_PORT=5672
RABBITMQ_MGMT_PORT=15672

# JWT Configuration
JWT_SECRET=${JWT_SECRET}
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# CORS Configuration
CORS_ORIGIN=*

# Backend Configuration
BACKEND_PORT=3001

# Frontend Configuration
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_SOCKET_URL=

# Nginx Configuration
NGINX_HTTP_PORT=8080
NGINX_HTTPS_PORT=8443
NGINX_SSL_MODE=auto
NGINX_SSL_CERT_FILE=/etc/nginx/ssl/nginx.crt
NGINX_SSL_KEY_FILE=/etc/nginx/ssl/nginx.key

# Build Configuration
NPM_REGISTRY=${NPM_REGISTRY}
EOF

    print_success ".env file created with secure random passwords"
    print_warning "Please save these credentials in a secure location!"
}

# Pull Docker images
pull_images() {
    print_step "Pulling Docker Images"

    print_msg "Pulling base images..." "$YELLOW"
    compose pull --ignore-buildable 2>/dev/null || true

    print_success "Base images pulled"
}

# Build Docker images
build_images() {
    print_step "Building Docker Images"

    print_msg "Building all services..." "$YELLOW"
    compose build --pull

    print_success "All images built successfully"
}

# Clean dangling images after rebuilds so storage doesn't keep growing.
prune_docker_cache() {
    print_step "Cleaning Docker Cache"

    docker builder prune -f >/dev/null 2>&1 || true
    docker image prune -f >/dev/null 2>&1 || true

    print_success "Dangling images and build cache cleaned"
}

# Rebuild the stack from scratch without deleting persistent volumes.
rebuild_services() {
    print_step "Rebuilding Services"

    print_msg "Stopping services and removing compose-managed images..." "$YELLOW"
    compose down --rmi all --remove-orphans

    prune_docker_cache

    print_msg "Rebuilding and starting services..." "$YELLOW"
    compose up --build -d --remove-orphans

    sync_postgres_password
    restart_backend_after_db_sync

    print_success "Services rebuilt successfully"
}

# Start services
start_services() {
    print_step "Starting Services"

    print_msg "Starting all containers..." "$YELLOW"
    compose up -d --remove-orphans

    print_msg "Waiting for services to be healthy..." "$YELLOW"
    sleep 30

    sync_postgres_password
    restart_backend_after_db_sync

    # Check service health
    local max_retries=30
    local retry=0

    while [ $retry -lt $max_retries ]; do
        if compose ps | grep -q "healthy\|running"; then
            break
        fi
        retry=$((retry + 1))
        echo -n "."
        sleep 2
    done
    echo ""

    print_success "All services started"
}

# Show status
show_status() {
    print_step "Service Status"

    compose ps

    echo ""
    print_msg "============================================" "$GREEN"
    print_msg "Deployment Complete!" "$GREEN"
    print_msg "============================================" "$GREEN"
    echo ""
    if [ "$USE_TENCENT_COMPOSE" = "true" ]; then
        print_msg "Compose mode: Tencent Cloud override ($TENCENT_COMPOSE_FILE)" "$BLUE"
        echo ""
    fi
    print_msg "Access the application at:" "$BLUE"
    print_msg "  HTTP:  http://localhost:${NGINX_HTTP_PORT:-8080}" "$BLUE"
    print_msg "  HTTPS: https://localhost:${NGINX_HTTPS_PORT:-8443}" "$BLUE"
    print_warning "HTTPS uses a self-signed certificate until NGINX_SSL_MODE=provided is configured with a real cert."
    echo ""
    print_msg "Management interfaces:" "$BLUE"
    print_msg "  RabbitMQ: http://localhost:${RABBITMQ_MGMT_PORT:-15672}" "$BLUE"
    echo ""
    print_msg "Useful commands:" "$YELLOW"
    print_msg "  View logs:     docker compose logs -f" "$YELLOW"
    print_msg "  Stop services: docker compose down" "$YELLOW"
    print_msg "  Restart:       docker compose restart" "$YELLOW"
    print_msg "  Remove all:    docker compose down -v" "$YELLOW"
    if [ "$USE_TENCENT_COMPOSE" = "true" ]; then
        print_msg "  Tencent mode:  docker compose -f docker-compose.yml -f $TENCENT_COMPOSE_FILE ..." "$YELLOW"
    fi
    echo ""
}

# Health check
health_check() {
    print_step "Running Health Checks"

    local services=("postgres" "redis" "rabbitmq" "backend" "frontend" "nginx")
    local all_healthy=true

    for service in "${services[@]}"; do
        local status=$(compose ps --format json "$service" 2>/dev/null | grep -o '"Health":"[^"]*"' | head -1 | cut -d'"' -f4)
        local state=$(compose ps --format json "$service" 2>/dev/null | grep -o '"State":"[^"]*"' | head -1 | cut -d'"' -f4)
        
        if [ "$state" = "running" ] || [ "$status" = "healthy" ]; then
            print_success "$service is running${status:+ ($status)}"
        else
            # Fallback: check if container exists at all
            if compose ps "$service" 2>/dev/null | grep -q "$service"; then
                print_success "$service is running"
            else
                print_error "$service is not running"
                all_healthy=false
            fi
        fi
    done

    if [ "$all_healthy" = true ]; then
        print_success "All services are healthy"
    else
        print_warning "Some services may still be starting. Wait 60s and check: docker compose ps"
    fi
}

# Stop services
stop_services() {
    print_step "Stopping Services"

    compose down

    print_success "All services stopped"
}

# Clean up
clean_up() {
    print_step "Cleaning Up"

    read -p "This will remove all containers, volumes, and images. Continue? (y/N): " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        compose down -v --rmi local
        print_success "Cleanup complete"
    else
        print_msg "Cleanup cancelled" "$YELLOW"
    fi
}

# Update application
update_app() {
    print_step "Updating Application"

    print_msg "Pulling latest changes..." "$YELLOW"
    git pull || true

    rebuild_services

    print_success "Application updated"
}

# Show logs
show_logs() {
    local service=$1
    if [ -z "$service" ]; then
        compose logs -f
    else
        compose logs -f "$service"
    fi
}

# Main menu
show_menu() {
    clear
    echo ""
    print_msg "============================================" "$BLUE"
    print_msg "  Chat Application - Docker Deployment" "$BLUE"
    print_msg "============================================" "$BLUE"
    echo ""
    echo "  [1] Full Install (Install Docker + Deploy)"
    echo "  [2] Quick Deploy (Docker already installed)"
    echo "  [3] Configure Docker Mirror (China)"
    echo "  [4] Start Services"
    echo "  [5] Stop Services"
    echo "  [6] Restart Services"
    echo "  [7] View Logs"
    echo "  [8] Health Check"
    echo "  [9] Update Application"
    echo "  [t] Tencent Cloud Deploy (use Tencent build image overrides)"
    echo "  [c] Clean Up (Remove all)"
    echo "  [0] Exit"
    echo ""
    read -p "  Enter your choice (0-9/t/c): " choice

    case $choice in
        1)
            check_root
            install_docker
            install_docker_compose
            configure_docker_mirror
            check_docker_service
            create_env_file
            rebuild_services
            health_check
            show_status
            ;;
        2)
            check_root
            check_docker_service
            create_env_file
            rebuild_services
            health_check
            show_status
            ;;
        3)
            configure_docker_mirror
            ;;
        4)
            start_services
            show_status
            ;;
        5)
            stop_services
            ;;
        6)
            stop_services
            start_services
            show_status
            ;;
        7)
            read -p "  Service name (leave empty for all): " service
            show_logs "$service"
            ;;
        8)
            health_check
            ;;
        9)
            update_app
            ;;
        t|T)
            enable_tencent_compose
            check_root
            check_docker_service
            create_env_file
            rebuild_services
            health_check
            show_status
            ;;
        c|C)
            clean_up
            ;;
        0)
            print_msg "Goodbye!" "$GREEN"
            exit 0
            ;;
        *)
            print_error "Invalid choice"
            sleep 2
            show_menu
            ;;
    esac
}

# Parse command line arguments
parse_global_options "$@"
command_arg=$(first_command_arg "$@")

if [ -n "$command_arg" ]; then
    case $command_arg in
        install)
            check_root
            install_docker
            install_docker_compose
            configure_docker_mirror
            check_docker_service
            ;;
        mirror)
            configure_docker_mirror
            ;;
        deploy)
            create_env_file
            rebuild_services
            health_check
            show_status
            ;;
        deploy-tencent|tencent)
            enable_tencent_compose
            create_env_file
            rebuild_services
            health_check
            show_status
            ;;
        start)
            start_services
            show_status
            ;;
        stop)
            stop_services
            ;;
        restart)
            stop_services
            start_services
            show_status
            ;;
        logs)
            show_logs "$2"
            ;;
        status)
            compose ps
            ;;
        health)
            health_check
            ;;
        update)
            update_app
            ;;
        clean)
            clean_up
            ;;
        --help|-h)
            echo "Usage: $0 [command]"
            echo "       $0 deploy --tencent"
            echo ""
            echo "Commands:"
            echo "  install   Install Docker and dependencies"
            echo "  mirror    Configure Docker mirror for China"
            echo "  deploy    Deploy the application"
            echo "  deploy-tencent"
            echo "            Deploy with docker-compose.tencent.yml build image overrides"
            echo "  start     Start all services"
            echo "  stop      Stop all services"
            echo "  restart   Restart all services"
            echo "  logs      View logs (optional: service name)"
            echo "  status    Show service status"
            echo "  health    Run health checks"
            echo "  update    Update and redeploy"
            echo "  clean     Remove all containers and volumes"
            echo ""
            echo "Options:"
            echo "  --tencent, --tencent-cloud, --tencent-mirror"
            echo "            Use docker-compose.tencent.yml for build base images"
            echo ""
            echo "Run without arguments for interactive menu."
            ;;
        *)
            print_error "Unknown command: $command_arg"
            echo "Run '$0 --help' for usage information."
            exit 1
            ;;
    esac
else
    show_menu
fi
