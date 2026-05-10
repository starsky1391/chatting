package controller

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"chat-backend/internal/config"
	"chat-backend/internal/middleware"
	"chat-backend/internal/service"
	"chat-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type AuthController struct {
	authService *service.AuthService
	cfg         *config.Config
}

func NewAuthController(authService *service.AuthService, cfg *config.Config) *AuthController {
	return &AuthController{
		authService: authService,
		cfg:         cfg,
	}
}

func (c *AuthController) Register(ctx *gin.Context) {
	var input service.RegisterInput
	if err := ctx.ShouldBindJSON(&input); err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	result, err := c.authService.Register(input)
	if err != nil {
		response.Error(ctx, 400, err.Error())
		return
	}

	// Generate token
	token, err := middleware.GenerateToken(result.User.ID, result.User.Username, c.cfg)
	if err != nil {
		response.InternalError(ctx, "Failed to generate token")
		return
	}
	result.AccessToken = token

	response.Created(ctx, result)
}

func (c *AuthController) Login(ctx *gin.Context) {
	var input service.LoginInput
	if err := ctx.ShouldBindJSON(&input); err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	result, err := c.authService.Login(input)
	if err != nil {
		response.Unauthorized(ctx, err.Error())
		return
	}

	// Generate token
	token, err := middleware.GenerateToken(result.User.ID, result.User.Username, c.cfg)
	if err != nil {
		response.InternalError(ctx, "Failed to generate token")
		return
	}
	result.AccessToken = token

	response.Success(ctx, result)
}

func (c *AuthController) Logout(ctx *gin.Context) {
	userID := ctx.GetUint("userID")

	if err := c.authService.Logout(userID); err != nil {
		response.InternalError(ctx, "Failed to logout")
		return
	}

	response.SuccessWithMessage(ctx, nil, "Logged out successfully")
}

func (c *AuthController) GetCurrentUser(ctx *gin.Context) {
	userID := ctx.GetUint("userID")

	user, err := c.authService.GetUserResponseByID(userID)
	if err != nil {
		response.NotFound(ctx, "User not found")
		return
	}

	response.Success(ctx, user)
}

func (c *AuthController) UpdateProfile(ctx *gin.Context) {
	userID := ctx.GetUint("userID")

	var input service.UpdateProfileInput
	if err := ctx.ShouldBindJSON(&input); err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	user, err := c.authService.UpdateProfile(userID, input)
	if err != nil {
		response.Error(ctx, 400, err.Error())
		return
	}

	response.Success(ctx, user)
}

func (c *AuthController) Heartbeat(ctx *gin.Context) {
	userID := ctx.GetUint("userID")

	if err := c.authService.Heartbeat(userID); err != nil {
		response.InternalError(ctx, "Failed to update heartbeat")
		return
	}

	response.Success(ctx, gin.H{"status": "ok"})
}

func (c *AuthController) UploadAvatar(ctx *gin.Context) {
	userID := ctx.GetUint("userID")

	_, header, err := ctx.Request.FormFile("avatar")
	if err != nil {
		response.BadRequest(ctx, "No file uploaded")
		return
	}

	// Validate file type
	ext := strings.ToLower(filepath.Ext(header.Filename))
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".gif" {
		response.BadRequest(ctx, "Invalid file type. Only jpg, jpeg, png, gif are allowed")
		return
	}

	// Create upload directory
	uploadDir := "uploads/avatars"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		response.InternalError(ctx, "Failed to create upload directory")
		return
	}

	// Generate filename
	filename := strconv.FormatUint(uint64(userID), 10) + "_" + strconv.FormatInt(time.Now().Unix(), 10) + ext
	filePath := filepath.Join(uploadDir, filename)

	// Save file
	if err := ctx.SaveUploadedFile(header, filePath); err != nil {
		response.InternalError(ctx, "Failed to save file")
		return
	}

	// Update user profile with avatar URL
	avatarURL := "/uploads/avatars/" + filename
	user, err := c.authService.UpdateProfile(userID, service.UpdateProfileInput{
		AvatarURL: avatarURL,
	})
	if err != nil {
		response.InternalError(ctx, "Failed to update profile")
		return
	}

	response.Success(ctx, gin.H{
		"avatarUrl": avatarURL,
		"user":      user,
	})
}

func (c *AuthController) GetOnlineUsers(ctx *gin.Context) {
	users, err := c.authService.GetOnlineUsers()
	if err != nil {
		response.InternalError(ctx, "Failed to get online users")
		return
	}

	response.Success(ctx, users)
}

// UploadImage handles general image uploads for messages
func (c *AuthController) UploadImage(ctx *gin.Context) {
	userID := ctx.GetUint("userID")

	file, header, err := ctx.Request.FormFile("image")
	if err != nil {
		response.BadRequest(ctx, "No image file provided")
		return
	}
	defer file.Close()

	// Validate file type
	ext := strings.ToLower(filepath.Ext(header.Filename))
	allowedExts := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true}
	if !allowedExts[ext] {
		response.BadRequest(ctx, "Invalid file type. Only images are allowed")
		return
	}

	// Validate file size (max 10MB)
	if header.Size > 10*1024*1024 {
		response.BadRequest(ctx, "File too large. Max size is 10MB")
		return
	}

	// Create upload directory
	uploadDir := "./uploads/images"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		response.InternalError(ctx, "Failed to create upload directory")
		return
	}

	// Generate filename
	filename := strconv.FormatUint(uint64(userID), 10) + "_" + strconv.FormatInt(time.Now().UnixNano(), 10) + ext
	filePath := filepath.Join(uploadDir, filename)

	// Save file
	if err := ctx.SaveUploadedFile(header, filePath); err != nil {
		response.InternalError(ctx, "Failed to save file")
		return
	}

	// Return image URL
	imageURL := "/uploads/images/" + filename
	response.Success(ctx, gin.H{
		"url": imageURL,
	})
}