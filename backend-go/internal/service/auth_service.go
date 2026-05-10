package service

import (
	"errors"
	"time"

	"chat-backend/internal/model"
	"chat-backend/internal/repository"
	"chat-backend/internal/config"
	"chat-backend/internal/redis"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AuthService struct {
	userRepo *repository.UserRepository
	cfg      *config.Config
	redis    *redis.RedisClient
}

func NewAuthService(userRepo *repository.UserRepository, cfg *config.Config, redisClient *redis.RedisClient) *AuthService {
	return &AuthService{
		userRepo: userRepo,
		cfg:      cfg,
		redis:    redisClient,
	}
}

type RegisterInput struct {
	Username string `json:"username" binding:"required,min=3,max=50"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

type LoginInput struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type AuthResponse struct {
	User        model.UserResponse `json:"user"`
	AccessToken string             `json:"accessToken"`
}

func (s *AuthService) Register(input RegisterInput) (*AuthResponse, error) {
	// Check if email exists
	existingUser, err := s.userRepo.FindByEmail(input.Email)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	if existingUser != nil && existingUser.ID != 0 {
		return nil, errors.New("email already exists")
	}

	// Check if username exists
	existingUser, err = s.userRepo.FindByUsername(input.Username)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	if existingUser != nil && existingUser.ID != 0 {
		return nil, errors.New("username already exists")
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	// Create user
	user := &model.User{
		Username: input.Username,
		Email:    input.Email,
		Password: string(hashedPassword),
		Avatar:   string(input.Username[0]),
		Role:     "member",
		IsOnline: true,
	}

	if err := s.userRepo.Create(user); err != nil {
		return nil, err
	}

	// Set online status in Redis
	if s.redis != nil {
		s.redis.SetUserOnline(user.ID, user.Username)
	}

	return &AuthResponse{
		User: model.ToUserResponse(*user),
	}, nil
}

func (s *AuthService) Login(input LoginInput) (*AuthResponse, error) {
	// Find user by email
	user, err := s.userRepo.FindByEmail(input.Email)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("invalid credentials")
		}
		return nil, err
	}

	// Compare password
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(input.Password)); err != nil {
		return nil, errors.New("invalid credentials")
	}

	// Update online status
	user.IsOnline = true
	user.LastSeen = nil
	s.userRepo.Update(user)

	// Set online status in Redis
	if s.redis != nil {
		s.redis.SetUserOnline(user.ID, user.Username)
	}

	return &AuthResponse{
		User: model.ToUserResponse(*user),
	}, nil
}

func (s *AuthService) Logout(userID uint) error {
	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		return err
	}

	user.IsOnline = false
	now := time.Now()
	user.LastSeen = &now
	s.userRepo.Update(user)

	// Set offline status in Redis
	if s.redis != nil {
		s.redis.SetUserOffline(userID)
	}

	return nil
}

func (s *AuthService) GetUserByID(id uint) (*model.User, error) {
	return s.userRepo.FindByID(id)
}

func (s *AuthService) GetUserResponseByID(id uint) (*model.UserResponse, error) {
	user, err := s.userRepo.FindByID(id)
	if err != nil {
		return nil, err
	}
	response := model.ToUserResponse(*user)
	return &response, nil
}

type UpdateProfileInput struct {
	Username  string `json:"username,omitempty"`
	Bio       string `json:"bio,omitempty"`
	AvatarURL string `json:"avatarUrl,omitempty"`
}

func (s *AuthService) UpdateProfile(userID uint, input UpdateProfileInput) (*model.UserResponse, error) {
	updates := map[string]interface{}{}

	if input.Username != "" {
		// Check if username is taken
		existing, err := s.userRepo.FindByUsername(input.Username)
		if err == nil && existing.ID != userID {
			return nil, errors.New("username already taken")
		}
		updates["username"] = input.Username
		updates["avatar"] = string(input.Username[0])
	}

	if input.Bio != "" {
		updates["bio"] = input.Bio
	}

	if input.AvatarURL != "" {
		updates["avatar_url"] = input.AvatarURL
	}

	if err := s.userRepo.UpdateProfile(userID, updates); err != nil {
		return nil, err
	}

	return s.GetUserResponseByID(userID)
}

// Heartbeat updates user's last seen time and marks them as online
func (s *AuthService) Heartbeat(userID uint) error {
	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		return err
	}

	user.IsOnline = true
	user.LastSeen = nil

	if s.redis != nil {
		s.redis.SetUserOnline(userID, user.Username)
	}

	if err := s.userRepo.Update(user); err != nil {
		return err
	}

	return nil
}

// SyncOnlineStatus syncs the database online status with Redis
// This should be called periodically to update users who haven't sent heartbeat
func (s *AuthService) SyncOnlineStatus() error {
	if s.redis == nil {
		return nil
	}

	// Get all users who are marked as online in database
	onlineUsers, err := s.userRepo.FindOnlineUsers()
	if err != nil {
		return err
	}

	for _, user := range onlineUsers {
		// Check if user is actually online in Redis
		redisOnline := s.redis.IsUserOnline(user.ID)

		// If Redis says offline but database says online, update database
		if !redisOnline && user.IsOnline {
			user.IsOnline = false
			now := time.Now()
			user.LastSeen = &now
			s.userRepo.Update(&user)
		}
	}

	return nil
}

// CheckOfflineUsers marks users as offline if they haven't sent heartbeat in 30 seconds
func (s *AuthService) CheckOfflineUsers() error {
	// This is called by a background job
	// Redis handles the TTL for online status
	return nil
}

func (s *AuthService) GetOnlineUsers() ([]model.UserResponse, error) {
	users, err := s.userRepo.FindOnlineUsers()
	if err != nil {
		return nil, err
	}

	responses := make([]model.UserResponse, len(users))
	for i, user := range users {
		responses[i] = model.ToUserResponse(user)
	}
	return responses, nil
}
