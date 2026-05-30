package router

import (
	"context"

	"chat-backend/internal/config"
	"chat-backend/internal/controller"
	"chat-backend/internal/events"
	"chat-backend/internal/livekit"
	"chat-backend/internal/middleware"
	"chat-backend/internal/redis"
	"chat-backend/internal/repository"
	"chat-backend/internal/service"
	"chat-backend/internal/socket"
	"chat-backend/pkg/logger"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func Setup(db *gorm.DB, cfg *config.Config, redisClient *redis.RedisClient) *gin.Engine {
	r := gin.Default()

	// CORS middleware
	r.Use(middleware.CORSMiddleware(cfg))

	// Initialize WebSocket hub before services so persisted events can fan out
	// through the same in-process connection registry.
	hub := socket.NewHub()
	go hub.Run()
	socket.SetGlobalHub(hub)

	var eventPublisher events.Publisher = events.NoopPublisher{}
	if cfg.Kafka.Enabled {
		kafkaBus, err := events.NewKafkaBus(cfg.Kafka)
		if err != nil {
			logger.Warn("Kafka event bus disabled: %v", err)
		} else {
			eventPublisher = kafkaBus
			go kafkaBus.StartConsumer(context.Background(), hub)
		}
	}

	// Initialize repositories
	userRepo := repository.NewUserRepository(db)
	groupRepo := repository.NewChannelGroupRepository(db)
	channelRepo := repository.NewChannelRepository(db)
	messageRepo := repository.NewMessageRepository(db)
	_ = repository.NewUserChannelRepository(db) // Reserved for future use
	userGroupRepo := repository.NewUserGroupRepository(db)
	groupRoleRepo := repository.NewGroupRoleRepository(db)
	aiConfigRepo := repository.NewGroupAIConfigRepository(db)
	wechatBindingRepo := repository.NewWechatBindingRepository(db)
	friendRequestRepo := repository.NewFriendRequestRepository(db)
	friendshipRepo := repository.NewFriendshipRepository(db)
	directConversationRepo := repository.NewDirectConversationRepository(db)
	directMessageRepo := repository.NewDirectMessageRepository(db)

	// Initialize services
	emailVerificationService := service.NewEmailVerificationService(userRepo, cfg.Email, cfg.Kafka, redisClient)
	authService := service.NewAuthService(userRepo, cfg, redisClient, emailVerificationService)
	aiService := service.NewAIService(cfg.AI)
	groupService := service.NewChannelGroupService(groupRepo, channelRepo, userRepo, userGroupRepo, groupRoleRepo, aiConfigRepo, redisClient)
	messageService := service.NewMessageService(messageRepo, userRepo, channelRepo, userGroupRepo, aiConfigRepo, aiService, eventPublisher)
	wechatService := service.NewWechatService(userRepo, wechatBindingRepo, cfg)
	friendService := service.NewFriendService(userRepo, friendRequestRepo, friendshipRepo)
	directMessageService := service.NewDirectMessageService(userRepo, friendshipRepo, directConversationRepo, directMessageRepo, eventPublisher)
	adminService := service.NewAdminService(db)

	// Initialize controllers
	authController := controller.NewAuthController(authService, cfg)
	groupController := controller.NewChannelGroupController(groupService)
	messageController := controller.NewMessageController(messageService)
	aiController := controller.NewAIController(aiService)
	wechatController := controller.NewWechatController(wechatService, cfg)
	friendController := controller.NewFriendController(friendService)
	directMessageController := controller.NewDirectMessageController(directMessageService)
	adminController := controller.NewAdminController(adminService)

	// Initialize LiveKit
	livekitConfig := livekit.Config{
		Host:      "ws://livekit:7880", // Docker 内部地址
		APIKey:    "devkey",
		APISecret: "secretsecretsecretsecretsecretsecret",
	}
	livekitTokenGen := livekit.NewTokenGenerator(livekitConfig)
	// LiveKit URL 从请求动态获取，不再硬编码
	livekitController := controller.NewLiveKitController(livekitTokenGen, groupService, "")

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
			"status":        "ok",
			"message":       "Chat Application Backend API (Go)",
			"version":       "2.0.0",
			"api_endpoints": "/api",
			"health_check":  "/health",
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
			auth.POST("/email-code", authController.SendEmailCode)
			auth.POST("/password-reset-code", authController.SendPasswordResetCode)
			auth.POST("/reset-password", authController.ResetPassword)
			auth.POST("/register", authController.Register)
			auth.POST("/login", authController.Login)
			auth.POST("/wechat/login", wechatController.Login)
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
			protected.POST("/ai", aiController.Ask)

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
				groups.PUT("/:id", groupController.UpdateGroup)
				groups.POST("/:id/join", groupController.JoinGroup)
				groups.POST("/:id/leave", groupController.LeaveGroup)
				groups.POST("/:id/ai-bot", groupController.AddAIBot)
				groups.DELETE("/:id/ai-bot", groupController.RemoveAIBot)
				groups.GET("/:id/ai-config", groupController.GetAIConfig)
				groups.PUT("/:id/ai-config", groupController.SaveAIConfig)
				groups.DELETE("/:id/ai-config", groupController.DeleteAIConfig)
				groups.GET("/:id/members", groupController.GetGroupMembers)
				groups.GET("/:id/roles", groupController.GetGroupRoles)
				groups.POST("/:id/roles", groupController.CreateGroupRole)
				groups.PUT("/:id/roles/:roleId", groupController.UpdateGroupRole)
				groups.DELETE("/:id/roles/:roleId", groupController.DeleteGroupRole)
				groups.PUT("/:id/members/:userId/role", groupController.UpdateMemberRole)
				groups.GET("/:id/channels", groupController.GetGroupChannels)
				groups.GET("/:id/channels/text", groupController.GetTextChannels)
				groups.GET("/:id/channels/voice", groupController.GetVoiceChannels)
				groups.POST("/:id/channels", groupController.CreateChannel)
				groups.PUT("/:id/channels/:channelId", groupController.UpdateChannel)
				groups.DELETE("/:id/channels/:channelId", groupController.DeleteChannel)
				groups.DELETE("/:id", groupController.DeleteGroup)
			}

			// Legacy channel routes (for backward compatibility)
			channels := protected.Group("/channels")
			{
				channels.GET("", groupController.GetAllGroups) // Redirect to groups
				channels.GET("/:id/messages", messageController.GetChannelMessages)
				channels.POST("/:id/messages", messageController.CreateMessage)
				channels.DELETE("/:id/messages/:messageId", messageController.RecallMessage)
				channels.GET("/:id/members", groupController.GetChannelMembers)              // Channel members via channel ID
				channels.GET("/:id/active-members", groupController.GetActiveChannelMembers) // Active members in channel (Redis)
			}

			// Voice channel routes
			voice := protected.Group("/voice")
			{
				voice.GET("/:channelId/participants", groupController.GetVoiceParticipants)
			}

			// Friend routes
			friends := protected.Group("/friends")
			{
				friends.GET("", friendController.ListFriends)
				friends.DELETE("/:id", friendController.RemoveFriend)
				friends.GET("/search", friendController.SearchUsers)
				friends.POST("/requests", friendController.CreateFriendRequest)
				friends.GET("/requests/incoming", friendController.ListIncomingRequests)
				friends.GET("/requests/outgoing", friendController.ListOutgoingRequests)
				friends.POST("/requests/:id/accept", friendController.AcceptRequest)
				friends.POST("/requests/:id/reject", friendController.RejectRequest)
			}

			// Direct message routes
			dm := protected.Group("/dm")
			{
				dm.GET("/conversations", directMessageController.ListConversations)
				dm.POST("/conversations", directMessageController.CreateConversation)
				dm.GET("/conversations/:id", directMessageController.GetConversation)
				dm.GET("/conversations/:id/messages", directMessageController.ListMessages)
				dm.POST("/conversations/:id/messages", directMessageController.CreateMessage)
				dm.DELETE("/conversations/:id/messages/:messageId", directMessageController.RecallMessage)
			}

			// LiveKit routes
			livekitGroup := protected.Group("/livekit")
			{
				livekitGroup.GET("/token", livekitController.GetToken)
				livekitGroup.POST("/webhook", livekitController.Webhook)
			}

			// Admin management routes
			admin := protected.Group("/admin")
			admin.Use(middleware.AdminMiddleware(userRepo))
			{
				admin.GET("/summary", adminController.Summary)
				admin.GET("/users", adminController.ListUsers)
				admin.PUT("/users/:id/role", adminController.UpdateUserRole)
				admin.DELETE("/users/:id", adminController.DeleteUser)
				admin.GET("/groups", adminController.ListGroups)
				admin.DELETE("/groups/:id", adminController.DeleteGroup)
				admin.GET("/messages", adminController.ListMessages)
				admin.DELETE("/messages/:id", adminController.DeleteMessage)
				admin.GET("/direct-messages", adminController.ListDirectMessages)
				admin.DELETE("/direct-messages/:id", adminController.DeleteDirectMessage)
			}

			// WebSocket route
			socket.SetRedisClient(redisClient)
			socket.SetUserRepository(userRepo)
			socket.SetChannelRepository(channelRepo)
			socket.SetUserGroupRepository(userGroupRepo)
			protected.GET("/ws", func(c *gin.Context) {
				socket.HandleWebSocket(hub, c)
			})
		}
	}

	return r
}
