package service

import (
	"errors"
	"strconv"
	"strings"
	"time"

	"chat-backend/internal/model"
	"chat-backend/internal/repository"
	"chat-backend/internal/redis"
	"chat-backend/pkg/utils"

	"gorm.io/gorm"
)

type ChannelGroupService struct {
	groupRepo     *repository.ChannelGroupRepository
	channelRepo   *repository.ChannelRepository
	userGroupRepo *repository.UserGroupRepository
	redis         *redis.RedisClient
}

func NewChannelGroupService(
	groupRepo *repository.ChannelGroupRepository,
	channelRepo *repository.ChannelRepository,
	userGroupRepo *repository.UserGroupRepository,
	redisClient *redis.RedisClient,
) *ChannelGroupService {
	return &ChannelGroupService{
		groupRepo:     groupRepo,
		channelRepo:   channelRepo,
		userGroupRepo: userGroupRepo,
		redis:         redisClient,
	}
}

type CreateGroupInput struct {
	Name        string `json:"name" binding:"required,min=1,max=50"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
}

type CreateChannelInput struct {
	Name        string `json:"name" binding:"required,min=1,max=50"`
	Type        string `json:"type" binding:"omitempty,oneof=text voice"`
	Description string `json:"description"`
	GroupID     uint   `json:"groupId" binding:"required"`
	Position    int    `json:"position"`
	CreatedBy   uint   `json:"-"` // Set by controller, not from request
}

func (s *ChannelGroupService) GetAllGroups() ([]model.ChannelGroupResponse, error) {
	groups, err := s.groupRepo.FindAll()
	if err != nil {
		return nil, err
	}

	responses := make([]model.ChannelGroupResponse, len(groups))
	for i, group := range groups {
		responses[i] = model.ToChannelGroupResponse(group)
	}
	return responses, nil
}

func (s *ChannelGroupService) GetGroupByID(id uint) (*model.ChannelGroupResponse, error) {
	group, err := s.groupRepo.FindByID(id)
	if err != nil {
		return nil, err
	}

	response := model.ToChannelGroupResponse(*group)
	return &response, nil
}

func (s *ChannelGroupService) GetUserGroups(userID uint) ([]model.ChannelGroupResponse, error) {
	groups, err := s.groupRepo.FindByUserID(userID)
	if err != nil {
		return nil, err
	}

	responses := make([]model.ChannelGroupResponse, len(groups))
	for i, group := range groups {
		// Get members for each group
		members, _ := s.userGroupRepo.GetGroupMembers(group.ID)
		response := model.ToChannelGroupResponse(group)

		// Add members to response with real-time online status from Redis
		memberResponses := make([]model.UserResponse, len(members))
		for j, member := range members {
			memberResponse := model.ToUserResponse(member)
			// Check real-time online status from Redis
			if s.redis != nil {
				memberResponse.IsOnline = s.redis.IsUserOnline(member.ID)
			}
			memberResponses[j] = memberResponse
		}
		response.Members = memberResponses

		responses[i] = response
	}
	return responses, nil
}

func (s *ChannelGroupService) CreateGroup(input CreateGroupInput, ownerID uint) (*model.ChannelGroupResponse, error) {
	// Generate unique invite code (globally unique)
	inviteCode := utils.GenerateInviteCode()
	maxAttempts := 10
	for i := 0; i < maxAttempts && s.groupRepo.InviteCodeExists(inviteCode); i++ {
		inviteCode = utils.GenerateInviteCode()
	}
	// If still not unique after max attempts, append timestamp
	if s.groupRepo.InviteCodeExists(inviteCode) {
		inviteCode = utils.GenerateInviteCode() + string(rune('A'+time.Now().Unix()%26))
	}

	group := &model.ChannelGroup{
		Name:        input.Name,
		Description: input.Description,
		Icon:        input.Icon,
		OwnerID:     ownerID,
		InviteCode:  inviteCode,
	}

	if err := s.groupRepo.Create(group); err != nil {
		return nil, err
	}

	// Add owner as member
	userGroup := &model.UserGroup{
		UserID:  ownerID,
		GroupID: group.ID,
		Role:    "owner",
	}
	s.userGroupRepo.Create(userGroup)

	// Create default channels
	textChannel := &model.Channel{
		Name:        "general",
		Type:        "text",
		Description: "General discussion",
		GroupID:     group.ID,
		Position:    0,
		CreatedBy:   0, // System created
	}
	s.channelRepo.Create(textChannel)

	voiceChannel := &model.Channel{
		Name:        "General Voice",
		Type:        "voice",
		Description: "General voice chat",
		GroupID:     group.ID,
		Position:    0,
		CreatedBy:   0, // System created
	}
	s.channelRepo.Create(voiceChannel)

	return s.GetGroupByID(group.ID)
}

func (s *ChannelGroupService) JoinGroup(userID, groupID uint) error {
	// Check if already joined
	if s.userGroupRepo.Exists(userID, groupID) {
		return nil
	}

	userGroup := &model.UserGroup{
		UserID:  userID,
		GroupID: groupID,
		Role:    "member",
	}

	return s.userGroupRepo.Create(userGroup)
}

func (s *ChannelGroupService) JoinGroupByInviteCode(userID uint, inviteCode string) (*model.ChannelGroupResponse, error) {
	// inviteCode format: "CODE#OWNER_ID" or just "CODE" (legacy support)
	parts := strings.SplitN(inviteCode, "#", 2)
	code := parts[0]

	var group *model.ChannelGroup
	var err error

	if len(parts) == 2 {
		ownerID, parseErr := strconv.Atoi(parts[1])
		if parseErr != nil {
			return nil, ErrInvalidInviteCode
		}
		group, err = s.groupRepo.FindByInviteCodeAndOwner(uint(ownerID), code)
	} else {
		group, err = s.groupRepo.FindByInviteCode(code)
	}

	if err != nil {
		return nil, ErrInvalidInviteCode
	}

	if err := s.JoinGroup(userID, group.ID); err != nil {
		return nil, err
	}

	return s.GetGroupByID(group.ID)
}

func (s *ChannelGroupService) GetGroupByInviteCode(inviteCode string) (*model.ChannelGroupResponse, error) {
	parts := strings.SplitN(inviteCode, "#", 2)
	code := parts[0]

	var group *model.ChannelGroup
	var err error

	if len(parts) == 2 {
		ownerID, parseErr := strconv.Atoi(parts[1])
		if parseErr != nil {
			return nil, ErrInvalidInviteCode
		}
		group, err = s.groupRepo.FindByInviteCodeAndOwner(uint(ownerID), code)
	} else {
		group, err = s.groupRepo.FindByInviteCode(code)
	}

	if err != nil {
		return nil, ErrInvalidInviteCode
	}

	return s.GetGroupByID(group.ID)
}

// GetGroupPreviewByInviteCode returns group info with membership check for the requesting user
func (s *ChannelGroupService) GetGroupPreviewByInviteCode(inviteCode string, userID uint) (*model.ChannelGroupResponse, error) {
	parts := strings.SplitN(inviteCode, "#", 2)
	code := parts[0]

	var group *model.ChannelGroup
	var err error

	if len(parts) == 2 {
		ownerID, parseErr := strconv.Atoi(parts[1])
		if parseErr != nil {
			return nil, ErrInvalidInviteCode
		}
		group, err = s.groupRepo.FindByInviteCodeAndOwner(uint(ownerID), code)
	} else {
		group, err = s.groupRepo.FindByInviteCode(code)
	}

	if err != nil {
		return nil, ErrInvalidInviteCode
	}

	// Get basic group info
	response := model.ToChannelGroupResponse(*group)

	// Get member count
	members, _ := s.userGroupRepo.GetGroupMembers(group.ID)
	response.MemberCount = len(members)

	// Check if user is a member
	response.IsMember = s.userGroupRepo.Exists(userID, group.ID)

	return &response, nil
}

// ErrInvalidInviteCode is returned when invite code is invalid
var ErrInvalidInviteCode = errors.New("invalid invite code")

func (s *ChannelGroupService) LeaveGroup(userID, groupID uint) error {
	return s.userGroupRepo.Delete(userID, groupID)
}

func (s *ChannelGroupService) GetGroupMembers(groupID uint) ([]model.UserResponse, error) {
	members, err := s.userGroupRepo.GetGroupMembers(groupID)
	if err != nil {
		return nil, err
	}

	responses := make([]model.UserResponse, len(members))
	for i, member := range members {
		response := model.ToUserResponse(member)
		// Check real-time online status from Redis
		// Only override if Redis is available and has data
		if s.redis != nil {
			// Redis has the authoritative online status
			response.IsOnline = s.redis.IsUserOnline(member.ID)
		}
		// If Redis is not available, use database value (already set by ToUserResponse)
		responses[i] = response
	}
	return responses, nil
}

func (s *ChannelGroupService) GetChannelMembers(channelID uint) ([]model.UserResponse, error) {
	// Get channel to find its group
	channel, err := s.channelRepo.FindByID(channelID)
	if err != nil {
		return nil, err
	}

	// Return group members as channel members with real-time online status
	members, err := s.userGroupRepo.GetGroupMembers(channel.GroupID)
	if err != nil {
		return nil, err
	}

	responses := make([]model.UserResponse, len(members))
	for i, member := range members {
		response := model.ToUserResponse(member)
		// Check real-time online status from Redis
		if s.redis != nil {
			response.IsOnline = s.redis.IsUserOnline(member.ID)
		}
		responses[i] = response
	}
	return responses, nil
}

// GetActiveChannelMembers returns members currently in the channel (from Redis)
func (s *ChannelGroupService) GetActiveChannelMembers(channelID uint) ([]map[string]interface{}, error) {
	if s.redis == nil {
		return []map[string]interface{}{}, nil
	}
	return s.redis.GetTextChannelMembers(channelID)
}

func (s *ChannelGroupService) CreateChannel(input CreateChannelInput) (*model.ChannelResponse, error) {
	channel := &model.Channel{
		Name:        input.Name,
		Type:        input.Type,
		Description: input.Description,
		GroupID:     input.GroupID,
		Position:    input.Position,
		CreatedBy:   input.CreatedBy,
	}

	if channel.Type == "" {
		channel.Type = "text"
	}

	if err := s.channelRepo.Create(channel); err != nil {
		return nil, err
	}

	// Publish update to Redis for real-time sync
	if s.redis != nil {
		s.redis.PublishChannelUpdate(input.GroupID, *channel)
	}

	response := model.ToChannelResponse(*channel)
	return &response, nil
}

func (s *ChannelGroupService) GetChannelsByGroup(groupID uint) ([]model.ChannelResponse, error) {
	channels, err := s.channelRepo.FindByGroupID(groupID)
	if err != nil {
		return nil, err
	}

	responses := make([]model.ChannelResponse, len(channels))
	for i, ch := range channels {
		responses[i] = model.ToChannelResponse(ch)
	}
	return responses, nil
}

func (s *ChannelGroupService) GetTextChannels(groupID uint) ([]model.ChannelResponse, error) {
	channels, err := s.channelRepo.FindByGroupIDAndType(groupID, "text")
	if err != nil {
		return nil, err
	}

	responses := make([]model.ChannelResponse, len(channels))
	for i, ch := range channels {
		responses[i] = model.ToChannelResponse(ch)
	}
	return responses, nil
}

func (s *ChannelGroupService) GetVoiceChannels(groupID uint) ([]model.ChannelResponse, error) {
	channels, err := s.channelRepo.FindByGroupIDAndType(groupID, "voice")
	if err != nil {
		return nil, err
	}

	responses := make([]model.ChannelResponse, len(channels))
	for i, ch := range channels {
		responses[i] = model.ToChannelResponse(ch)
	}
	return responses, nil
}

func (s *ChannelGroupService) DeleteChannel(channelID, userID uint) error {
	// Get channel to find group and creator
	channel, err := s.channelRepo.FindByID(channelID)
	if err != nil {
		return err
	}

	// Check permission: user must be group owner/admin/moderator OR channel creator
	userRole := s.userGroupRepo.GetUserRole(userID, channel.GroupID)

	// Allow if user is owner, admin, or moderator
	if userRole == "owner" || userRole == "admin" || userRole == "moderator" {
		return s.channelRepo.Delete(channelID)
	}

	// Allow if user is the channel creator
	if channel.CreatedBy == userID {
		return s.channelRepo.Delete(channelID)
	}

	// No permission
	return ErrNoPermission
}

// ErrNoPermission is returned when user lacks permission
var ErrNoPermission = errors.New("permission denied")

func (s *ChannelGroupService) DeleteGroup(groupID uint) error {
	return s.groupRepo.DB().Transaction(func(tx *gorm.DB) error {
		// 1. 硬删除该群组下所有成员关系（不能用软删除，否则外键约束仍生效）
		if err := tx.Unscoped().Where("group_id = ?", groupID).Delete(&model.UserGroup{}).Error; err != nil {
			return err
		}
		// 2. 删除该群组下所有频道（CASCADE 会自动删除关联的 messages）
		if err := tx.Unscoped().Where("group_id = ?", groupID).Delete(&model.Channel{}).Error; err != nil {
			return err
		}
		// 3. 删除群组本身
		if err := tx.Unscoped().Delete(&model.ChannelGroup{}, groupID).Error; err != nil {
			return err
		}
		return nil
	})
}

// Voice channel participant management
func (s *ChannelGroupService) JoinVoiceChannel(channelID uint, userID uint, username string) error {
	if s.redis != nil {
		return s.redis.JoinVoiceChannel(channelID, userID, username)
	}
	return nil
}

func (s *ChannelGroupService) LeaveVoiceChannel(channelID uint, userID uint) error {
	if s.redis != nil {
		return s.redis.LeaveVoiceChannel(channelID, userID)
	}
	return nil
}

func (s *ChannelGroupService) GetVoiceChannelParticipants(channelID uint) ([]map[string]interface{}, error) {
	if s.redis != nil {
		return s.redis.GetVoiceChannelParticipants(channelID)
	}
	return []map[string]interface{}{}, nil
}