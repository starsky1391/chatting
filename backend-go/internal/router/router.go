package router

import (
	"chat-backend/internal/config"
	"chat-backend/internal/controller"
	"chat-backend/internal/middleware"
	"chat-backend/internal/repository"
	"chat-backend/internal/service"
	"chat-backend/internal/socket"
	"chat-backend/internal/redis"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func Setup(db *gorm.DB, cfg *config.Config, redisClient *redis.RedisClient) *gin.Engine {
	r := gin.Default()

	// CORS middleware
	r.Use(middleware.CORSMiddleware(cfg))

	// Initialize repositories
	userRepo := repository.NewUserRepository(db)
	groupRepo := repository.NewChannelGroupRepository(db)
	channelRepo := repository.NewChannelRepository(db)
	messageRepo := repository.NewMessageRepository(db)
	_ = repository.NewUserChannelRepository(db) // Reserved for future use
	userGroupRepo := repository.NewUserGroupRepository(db)

	// Initialize services
	authService := service.NewAuthService(userRepo, cfg, redisClient)
	groupService := service.NewChannelGroupService(groupRepo, channelRepo, userGroupRepo, redisClient)
	messageService := service.NewMessageService(messageRepo, userRepo)

	// Initialize controllers
	authController := controller.NewAuthController(authService, cfg)
	groupController := controller.NewChannelGroupController(groupService)
	messageController := controller.NewMessageController(messageService)

	// Initialize WebSocket hub
	hub := socket.NewHub()
	go hub.Run()
	socket.SetGlobalHub(hub)

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"message": "Server is running",
		})
	})

	// Root endpoint
	r.GET("/", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":         "ok",
			"message":        "Chat Application Backend API (Go)",
			"version":        "2.0.0",
			"api_endpoints":  "/api",
			"health_check":   "/health",
		})
	})

	// Static files for uploads
	r.Static("/uploads", "./uploads")

	// API routes
	api := r.Group("/api")
	{
		// Auth routes (public)
		auth := api.Group("/auth")
		{
			auth.POST("/register", authController.Register)
			auth.POST("/login", authController.Login)
		}

		// Public invite routes
		api.GET("/invite/:code", groupController.GetGroupByInviteCode)

		// Protected routes
		protected := api.Group("")
		protected.Use(middleware.AuthMiddleware(cfg))
		{
			// User routes
			protected.GET("/user", authController.GetCurrentUser)
			protected.PUT("/user", authController.UpdateProfile)
			protected.POST("/user/heartbeat", authController.Heartbeat)
			protected.POST("/user/avatar", authController.UploadAvatar)
			protected.POST("/auth/logout", authController.Logout)
			protected.GET("/users/online", authController.GetOnlineUsers)

			// Upload routes
			protected.POST("/upload", authController.UploadImage)

			// Group preview for share links (with membership check)
			protected.GET("/invite/:code/preview", groupController.GetGroupPreview)

			// Channel group routes (new structure)
			groups := protected.Group("/groups")
			{
				groups.GET("", groupController.GetUserGroups)
				groups.GET("/all", groupController.GetAllGroups)
				groups.POST("", groupController.CreateGroup)
				groups.POST("/join/:code", groupController.JoinGroupByInviteCode)
				groups.GET("/:id", groupController.GetGroupByID)
				groups.POST("/:id/join", groupController.JoinGroup)
				groups.POST("/:id/leave", groupController.LeaveGroup)
				groups.GET("/:id/members", groupController.GetGroupMembers)
				groups.GET("/:id/channels", groupController.GetGroupChannels)
				groups.GET("/:id/channels/text", groupController.GetTextChannels)
				groups.GET("/:id/channels/voice", groupController.GetVoiceChannels)
				groups.POST("/:id/channels", groupController.CreateChannel)
				groups.DELETE("/:id/channels/:channelId", groupController.DeleteChannel)
				groups.DELETE("/:id", groupController.DeleteGroup)
			}

			// Legacy channel routes (for backward compatibility)
			channels := protected.Group("/channels")
			{
				channels.GET("", groupController.GetAllGroups) // Redirect to groups
				channels.GET("/:id/messages", messageController.GetChannelMessages)
				channels.POST("/:id/messages", messageController.CreateMessage)
				channels.GET("/:id/members", groupController.GetChannelMembers) // Channel members via channel ID
				channels.GET("/:id/active-members", groupController.GetActiveChannelMembers) // Active members in channel (Redis)
			}

			// Voice channel routes
			voice := protected.Group("/voice")
			{
				voice.GET("/:channelId/participants", groupController.GetVoiceParticipants)
			}

			// WebSocket route
			socket.SetRedisClient(redisClient)
			socket.SetUserRepository(userRepo)
			protected.GET("/ws", func(c *gin.Context) {
				socket.HandleWebSocket(hub, c)
			})
		}
	}

	return r
}
