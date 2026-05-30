package main

import (
	"log"
	"time"

	"chat-backend/internal/config"
	"chat-backend/internal/model"
	"chat-backend/internal/redis"
	"chat-backend/internal/repository"
	"chat-backend/internal/router"
	"chat-backend/internal/service"
	"chat-backend/pkg/logger"

	"gorm.io/gorm"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Initialize logger
	logger.Init(cfg.LogLevel)

	// Initialize database
	db, err := model.InitDB(cfg.Database)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Auto migrate models
	err = model.AutoMigrate(db)
	if err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}

	// Ensure an admin account exists for the management console
	err = model.SeedAdminUser(db, cfg.Admin)
	if err != nil {
		log.Fatalf("Failed to seed admin user: %v", err)
	}

	// Create default channels
	err = model.CreateDefaultChannels(db, cfg.Admin.Email)
	if err != nil {
		logger.Warn("Failed to create default channels: %v", err)
	}

	err = model.SeedDefaultGroupRoles(db)
	if err != nil {
		logger.Warn("Failed to seed default group roles: %v", err)
	}

	// Initialize Redis client (optional)
	redisClient, err := redis.NewRedisClient(cfg.Redis)
	if err != nil {
		logger.Warn("Redis not available, using in-memory storage: %v", err)
	}

	// Start background task to sync online status
	if redisClient != nil {
		go startOnlineStatusSync(db, redisClient)
	}

	// Initialize router and start server
	r := router.Setup(db, cfg, redisClient)

	logger.Info("Server starting on port %s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

// startOnlineStatusSync runs a background task to sync online status
func startOnlineStatusSync(db *gorm.DB, redisClient *redis.RedisClient) {
	userRepo := repository.NewUserRepository(db)
	authService := service.NewAuthService(userRepo, nil, redisClient, nil)

	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		if err := authService.SyncOnlineStatus(); err != nil {
			logger.Warn("Failed to sync online status: %v", err)
		}
	}
}
