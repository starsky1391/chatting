# ============================================
# Chat Application - Makefile
# ============================================

.PHONY: help install deploy start stop restart logs status health update clean build

# Default target
help:
	@echo ""
	@echo "Chat Application - Docker Deployment Commands"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  install    Install Docker and dependencies"
	@echo "  deploy     Full deployment (build + start)"
	@echo "  start      Start all services"
	@echo "  stop       Stop all services"
	@echo "  restart    Restart all services"
	@echo "  logs       View logs (use: make logs service=backend)"
	@echo "  status     Show service status"
	@echo "  health     Run health checks"
	@echo "  build      Build Docker images"
	@echo "  update     Update and redeploy"
	@echo "  clean      Remove all containers and volumes"
	@echo "  shell      Open shell in backend container"
	@echo ""

# Install Docker
install:
	@echo "Installing Docker..."
	@curl -fsSL https://get.docker.com | sh
	@sudo usermod -aG docker $(USER)
	@echo "Docker installed. Please log out and back in."

# Create environment file
env:
	@if [ ! -f .env ]; then \
		echo "Creating .env file..."; \
		cp .env.example .env; \
		echo "Please edit .env with your settings"; \
	else \
		echo ".env already exists"; \
	fi

# Build images
build:
	@echo "Building Docker images..."
	docker compose build

# Deploy
deploy: env build
	@echo "Starting services..."
	docker compose up -d
	@echo ""
	@echo "Waiting for services to be healthy..."
	@sleep 15
	@docker compose ps
	@echo ""
	@echo "Deployment complete!"
	@echo "Access: http://localhost:8080"

# Start services
start:
	docker compose up -d

# Stop services
stop:
	docker compose down

# Restart services
restart: stop start
	@echo "Services restarted"

# View logs
logs:
	@if [ -n "$(service)" ]; then \
		docker compose logs -f $(service); \
	else \
		docker compose logs -f; \
	fi

# Show status
status:
	@docker compose ps

# Health check
health:
	@echo "Checking service health..."
	@docker compose ps
	@echo ""
	@curl -s http://localhost:8080/health || echo "Nginx health check failed"
	@curl -s http://localhost:3001/health || echo "Backend health check failed"

# Update application
update:
	@echo "Updating application..."
	git pull || true
	docker compose build --no-cache
	docker compose down
	docker compose up -d
	@echo "Update complete"

# Clean up
clean:
	@echo "Removing all containers, volumes, and images..."
	docker compose down -v --rmi local
	@echo "Cleanup complete"

# Open shell in backend
shell:
	docker compose exec backend sh

# Open shell in frontend
shell-frontend:
	docker compose exec frontend sh

# Database shell
db-shell:
	docker compose exec postgres psql -U postgres -d chat_app

# Redis shell
redis-shell:
	docker compose exec redis redis-cli -a $(REDIS_PASSWORD)

# Show all container stats
stats:
	docker compose stats