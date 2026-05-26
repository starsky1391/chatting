package service

import (
	"errors"
	"strconv"
	"strings"
	"time"

	"chat-backend/internal/model"
	"chat-backend/internal/redis"
	"chat-backend/internal/repository"
	"chat-backend/pkg/utils"

	"gorm.io/gorm"
)

type ChannelGroupService struct {
	groupRepo     *repository.ChannelGroupRepository
	channelRepo   *repository.ChannelRepository
	userGroupRepo *repository.UserGroupRepository
	groupRoleRepo *repository.GroupRoleRepository
	redis         *redis.RedisClient
}

func NewChannelGroupService(
	groupRepo *repository.ChannelGroupRepository,
	channelRepo *repository.ChannelRepository,
	userGroupRepo *repository.UserGroupRepository,
	groupRoleRepo *repository.GroupRoleRepository,
	redisClient *redis.RedisClient,
) *ChannelGroupService {
	return &ChannelGroupService{
		groupRepo:     groupRepo,
		channelRepo:   channelRepo,
		userGroupRepo: userGroupRepo,
		groupRoleRepo: groupRoleRepo,
		redis:         redisClient,
	}
}

type CreateGroupInput struct {
	Name        string `json:"name" binding:"required,min=1,max=50"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
}

type UpdateGroupInput struct {
	Name        string `json:"name" binding:"required,min=1,max=50"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
}

type CreateChannelInput struct {
	Name        string `json:"name" binding:"required,min=1,max=50"`
	Type        string `json:"type" binding:"omitempty,oneof=text voice"`
	Description string `json:"description"`
	GroupID     uint   `json:"groupId"`
	Position    int    `json:"position"`
	CreatedBy   uint   `json:"-"` // Set by controller, not from request
	MaxMembers  int    `json:"maxMembers" binding:"omitempty,min=0,max=100"`
}

type UpdateChannelInput struct {
	Name        string `json:"name" binding:"required,min=1,max=50"`
	Description string `json:"description"`
	MaxMembers  int    `json:"maxMembers" binding:"omitempty,min=0,max=100"`
}

type CreateGroupRoleInput struct {
	Name        string `json:"name" binding:"required,min=1,max=32"`
	Description string `json:"description"`
	Color       string `json:"color"`
	Position    int    `json:"position"`
	IsDefault   bool   `json:"isDefault"`
}

type UpdateGroupRoleInput struct {
	Name        string `json:"name" binding:"required,min=1,max=32"`
	Description string `json:"description"`
	Color       string `json:"color"`
	Position    int    `json:"position"`
	IsDefault   bool   `json:"isDefault"`
}

type UpdateMemberRoleInput struct {
	RoleID uint `json:"roleId" binding:"required"`
}

func (s *ChannelGroupService) GetAllGroups() ([]model.ChannelGroupResponse, error) {
	groups, err := s.groupRepo.FindAll()
	if err != nil {
		return nil, err
	}

	responses := make([]model.ChannelGroupResponse, len(groups))
	for i, group := range groups {
		response := model.ToChannelGroupResponse(group)
		if roles, err := s.getGroupRoleResponses(group.ID); err == nil {
			response.Roles = roles
		}
		responses[i] = response
	}
	return responses, nil
}

func (s *ChannelGroupService) GetGroupByID(id uint) (*model.ChannelGroupResponse, error) {
	group, err := s.groupRepo.FindByID(id)
	if err != nil {
		return nil, err
	}

	response := model.ToChannelGroupResponse(*group)
	if roles, err := s.getGroupRoleResponses(group.ID); err == nil {
		response.Roles = roles
	}
	return &response, nil
}

func (s *ChannelGroupService) GetUserGroups(userID uint) ([]model.ChannelGroupResponse, error) {
	groups, err := s.groupRepo.FindByUserID(userID)
	if err != nil {
		return nil, err
	}

	responses := make([]model.ChannelGroupResponse, len(groups))
	for i, group := range groups {
		response := model.ToChannelGroupResponse(group)

		memberResponses, _ := s.getGroupMemberResponses(group.ID)
		response.Members = memberResponses
		if roles, err := s.getGroupRoleResponses(group.ID); err == nil {
			response.Roles = roles
		}

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
	if err := s.userGroupRepo.Create(userGroup); err != nil {
		return nil, err
	}

	if err := s.ensureDefaultRoles(group.ID); err != nil {
		return nil, err
	}

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
		MaxMembers:  100,
	}
	s.channelRepo.Create(voiceChannel)

	return s.GetGroupByID(group.ID)
}

func (s *ChannelGroupService) UpdateGroup(groupID, userID uint, input UpdateGroupInput) (*model.ChannelGroupResponse, error) {
	group, err := s.groupRepo.FindByID(groupID)
	if err != nil {
		return nil, err
	}

	if !s.canManageGroup(userID, group.ID) {
		return nil, ErrNoPermission
	}

	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, errors.New("group name is required")
	}

	group.Name = name
	group.Description = strings.TrimSpace(input.Description)
	group.Icon = strings.TrimSpace(input.Icon)

	if err := s.groupRepo.Update(group); err != nil {
		return nil, err
	}

	return s.GetGroupByID(group.ID)
}

func (s *ChannelGroupService) JoinGroup(userID, groupID uint) error {
	if err := s.ensureDefaultRoles(groupID); err != nil {
		return err
	}

	// Check if already joined
	if s.userGroupRepo.Exists(userID, groupID) {
		return nil
	}

	defaultRole := "guest"
	if s.groupRoleRepo != nil {
		if role, err := s.groupRoleRepo.FindDefaultByGroupID(groupID); err == nil && role != nil {
			defaultRole = role.Name
		}
	}

	userGroup := &model.UserGroup{
		UserID:  userID,
		GroupID: groupID,
		Role:    defaultRole,
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
	memberResponses, _ := s.getGroupMemberResponses(group.ID)
	response.MemberCount = len(memberResponses)

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
	members, err := s.getGroupMemberResponses(groupID)
	if err != nil {
		return nil, err
	}
	return members, nil
}

func (s *ChannelGroupService) GetChannelMembers(channelID uint) ([]model.UserResponse, error) {
	// Get channel to find its group
	channel, err := s.channelRepo.FindByID(channelID)
	if err != nil {
		return nil, err
	}

	// Return group members as channel members with real-time online status
	members, err := s.getGroupMemberResponses(channel.GroupID)
	if err != nil {
		return nil, err
	}
	return members, nil
}

// GetActiveChannelMembers returns members currently in the channel (from Redis)
func (s *ChannelGroupService) GetActiveChannelMembers(channelID uint) ([]map[string]interface{}, error) {
	if s.redis == nil {
		return []map[string]interface{}{}, nil
	}

	channel, err := s.channelRepo.FindByID(channelID)
	if err != nil {
		return nil, err
	}

	members, err := s.redis.GetTextChannelMembers(channelID)
	if err != nil {
		return nil, err
	}

	filtered := make([]map[string]interface{}, 0, len(members))
	for _, member := range members {
		userID, ok := memberUserID(member)
		if !ok {
			continue
		}

		userGroup, err := s.userGroupRepo.FindByUserAndGroup(userID, channel.GroupID)
		if err != nil {
			_ = s.redis.LeaveTextChannel(channelID, userID)
			continue
		}

		member["groupRole"] = userGroup.Role
		filtered = append(filtered, member)
	}

	return filtered, nil
}

func (s *ChannelGroupService) CreateChannel(input CreateChannelInput) (*model.ChannelResponse, error) {
	input.Name = strings.TrimSpace(input.Name)
	if input.Name == "" {
		return nil, errors.New("channel name is required")
	}
	if s.channelRepo.NameExists(input.GroupID, input.Name, 0) {
		return nil, ErrChannelNameExists
	}

	channel := &model.Channel{
		Name:        input.Name,
		Type:        input.Type,
		Description: input.Description,
		GroupID:     input.GroupID,
		Position:    input.Position,
		CreatedBy:   input.CreatedBy,
		MaxMembers:  input.MaxMembers,
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

func (s *ChannelGroupService) UpdateChannel(channelID, userID uint, input UpdateChannelInput) (*model.ChannelResponse, error) {
	channel, err := s.channelRepo.FindByID(channelID)
	if err != nil {
		return nil, err
	}

	if !s.canManageChannel(userID, channel) {
		return nil, ErrNoPermission
	}

	input.Name = strings.TrimSpace(input.Name)
	if input.Name == "" {
		return nil, errors.New("channel name is required")
	}
	if s.channelRepo.NameExists(channel.GroupID, input.Name, channelID) {
		return nil, ErrChannelNameExists
	}

	channel.Name = input.Name
	channel.Description = input.Description
	if channel.Type == "voice" {
		channel.MaxMembers = input.MaxMembers
	}

	if err := s.channelRepo.Update(channel); err != nil {
		return nil, err
	}

	if s.redis != nil {
		s.redis.PublishChannelUpdate(channel.GroupID, *channel)
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

	if s.canManageChannel(userID, channel) {
		return s.channelRepo.Delete(channelID)
	}

	return ErrNoPermission
}

// ErrNoPermission is returned when user lacks permission
var ErrNoPermission = errors.New("permission denied")
var ErrChannelNameExists = errors.New("channel name already exists")
var ErrVoiceChannelFull = errors.New("voice channel is full")
var ErrNotVoiceChannel = errors.New("not a voice channel")

func (s *ChannelGroupService) canManageChannel(userID uint, channel *model.Channel) bool {
	userRole := s.userGroupRepo.GetUserRole(userID, channel.GroupID)
	if userRole == "owner" || userRole == "admin" || userRole == "moderator" {
		return true
	}
	return channel.CreatedBy == userID
}

func (s *ChannelGroupService) canManageGroup(userID uint, groupID uint) bool {
	userRole := s.userGroupRepo.GetUserRole(userID, groupID)
	return userRole == "owner" || userRole == "admin" || userRole == "moderator"
}

func (s *ChannelGroupService) DeleteGroup(groupID uint) error {
	return s.groupRepo.DB().Transaction(func(tx *gorm.DB) error {
		// 1. 硬删除该群组下所有成员关系（不能用软删除，否则外键约束仍生效）
		if err := tx.Unscoped().Where("group_id = ?", groupID).Delete(&model.UserGroup{}).Error; err != nil {
			return err
		}
		if err := tx.Unscoped().Where("group_id = ?", groupID).Delete(&model.GroupRole{}).Error; err != nil {
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

func (s *ChannelGroupService) GetGroupRoles(groupID uint) ([]model.GroupRoleResponse, error) {
	return s.getGroupRoleResponses(groupID)
}

func (s *ChannelGroupService) CreateGroupRole(groupID, userID uint, input CreateGroupRoleInput) (*model.GroupRoleResponse, error) {
	if !s.canManageGroup(userID, groupID) {
		return nil, ErrNoPermission
	}

	role := &model.GroupRole{
		GroupID:     groupID,
		Name:        strings.TrimSpace(input.Name),
		Description: strings.TrimSpace(input.Description),
		Color:       strings.TrimSpace(input.Color),
		Position:    input.Position,
		IsDefault:   input.IsDefault,
		IsSystem:    false,
	}
	if role.Name == "" {
		return nil, errors.New("role name is required")
	}
	if s.groupRoleRepo.Exists(groupID, role.Name) {
		return nil, errors.New("role name already exists")
	}
	if role.IsDefault {
		if err := s.clearDefaultGroupRole(groupID); err != nil {
			return nil, err
		}
	}
	if err := s.groupRoleRepo.Create(role); err != nil {
		return nil, err
	}

	response := model.ToGroupRoleResponse(*role)
	return &response, nil
}

func (s *ChannelGroupService) UpdateGroupRole(groupID, roleID, userID uint, input UpdateGroupRoleInput) (*model.GroupRoleResponse, error) {
	if !s.canManageGroup(userID, groupID) {
		return nil, ErrNoPermission
	}

	role, err := s.groupRoleRepo.FindByID(roleID)
	if err != nil {
		return nil, err
	}
	if role.GroupID != groupID {
		return nil, ErrInvalidInviteCode
	}

	oldName := role.Name
	newName := strings.TrimSpace(input.Name)
	if newName == "" {
		return nil, errors.New("role name is required")
	}
	if oldName != newName && s.groupRoleRepo.Exists(groupID, newName) {
		return nil, errors.New("role name already exists")
	}

	role.Name = newName
	role.Description = strings.TrimSpace(input.Description)
	role.Color = strings.TrimSpace(input.Color)
	role.Position = input.Position
	if input.IsDefault {
		if err := s.clearDefaultGroupRole(groupID); err != nil {
			return nil, err
		}
		role.IsDefault = true
	} else {
		role.IsDefault = false
	}

	if err := s.groupRoleRepo.Update(role); err != nil {
		return nil, err
	}
	if oldName != role.Name {
		if err := s.userGroupRepo.DB().Model(&model.UserGroup{}).
			Where("group_id = ? AND role = ?", groupID, oldName).
			Update("role", role.Name).Error; err != nil {
			return nil, err
		}
	}

	response := model.ToGroupRoleResponse(*role)
	return &response, nil
}

func (s *ChannelGroupService) DeleteGroupRole(groupID, roleID, userID uint) error {
	if !s.canManageGroup(userID, groupID) {
		return ErrNoPermission
	}

	role, err := s.groupRoleRepo.FindByID(roleID)
	if err != nil {
		return err
	}
	if role.GroupID != groupID {
		return ErrInvalidInviteCode
	}
	if role.IsSystem {
		return ErrNoPermission
	}

	if err := s.userGroupRepo.DB().Model(&model.UserGroup{}).
		Where("group_id = ? AND role = ?", groupID, role.Name).
		Update("role", "guest").Error; err != nil {
		return err
	}
	return s.groupRoleRepo.Delete(roleID)
}

func (s *ChannelGroupService) AssignMemberRole(groupID, targetUserID, roleID, actorID uint) error {
	if !s.canManageGroup(actorID, groupID) {
		return ErrNoPermission
	}

	role, err := s.groupRoleRepo.FindByID(roleID)
	if err != nil {
		return err
	}
	if role.GroupID != groupID || role.Name == "owner" {
		return ErrNoPermission
	}

	member, err := s.userGroupRepo.FindByUserAndGroup(targetUserID, groupID)
	if err != nil {
		return err
	}
	if member.Role == "owner" {
		return ErrNoPermission
	}

	return s.userGroupRepo.UpdateRole(targetUserID, groupID, role.Name)
}

func (s *ChannelGroupService) ensureDefaultRoles(groupID uint) error {
	if s.groupRoleRepo == nil {
		return nil
	}

	defaultRoles := []model.GroupRole{
		{
			GroupID:     groupID,
			Name:        "admin",
			Description: "Can manage members and channels",
			Color:       "#8b5cf6",
			Position:    1,
			IsSystem:    true,
		},
		{
			GroupID:     groupID,
			Name:        "guest",
			Description: "Default role for new members",
			Color:       "#14b8a6",
			Position:    2,
			IsDefault:   true,
			IsSystem:    true,
		},
	}

	for _, role := range defaultRoles {
		if !s.groupRoleRepo.Exists(groupID, role.Name) {
			roleCopy := role
			if err := s.groupRoleRepo.Create(&roleCopy); err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *ChannelGroupService) clearDefaultGroupRole(groupID uint) error {
	if s.groupRoleRepo == nil {
		return nil
	}

	roles, err := s.groupRoleRepo.FindByGroupID(groupID)
	if err != nil {
		return err
	}
	for _, role := range roles {
		if role.IsDefault {
			updated := role
			updated.IsDefault = false
			if err := s.groupRoleRepo.Update(&updated); err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *ChannelGroupService) getGroupRoleResponses(groupID uint) ([]model.GroupRoleResponse, error) {
	if s.groupRoleRepo == nil {
		return []model.GroupRoleResponse{}, nil
	}

	roles, err := s.groupRoleRepo.FindByGroupID(groupID)
	if err != nil {
		return nil, err
	}

	responses := make([]model.GroupRoleResponse, len(roles))
	for i, role := range roles {
		responses[i] = model.ToGroupRoleResponse(role)
	}
	return responses, nil
}

func (s *ChannelGroupService) getGroupMemberResponses(groupID uint) ([]model.UserResponse, error) {
	members, err := s.userGroupRepo.FindByGroupID(groupID)
	if err != nil {
		return nil, err
	}

	responses := make([]model.UserResponse, len(members))
	for i, member := range members {
		response := model.ToUserResponse(member.User)
		response.GroupRole = member.Role
		if s.redis != nil {
			response.IsOnline = s.redis.IsUserOnline(member.User.ID)
		}
		responses[i] = response
	}
	return responses, nil
}

func memberUserID(member map[string]interface{}) (uint, bool) {
	value, ok := member["userId"]
	if !ok {
		value, ok = member["id"]
	}
	if !ok {
		return 0, false
	}

	switch typed := value.(type) {
	case float64:
		if typed <= 0 {
			return 0, false
		}
		return uint(typed), true
	case int:
		if typed <= 0 {
			return 0, false
		}
		return uint(typed), true
	case uint:
		return typed, typed > 0
	case string:
		parsed, err := strconv.ParseUint(typed, 10, 32)
		if err != nil || parsed == 0 {
			return 0, false
		}
		return uint(parsed), true
	default:
		return 0, false
	}
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

func (s *ChannelGroupService) ValidateVoiceChannelJoin(channelID uint, userID uint) error {
	channel, err := s.channelRepo.FindByID(channelID)
	if err != nil {
		return err
	}
	if channel.Type != "voice" {
		return ErrNotVoiceChannel
	}
	if !s.userGroupRepo.Exists(userID, channel.GroupID) {
		return ErrNoPermission
	}
	if channel.MaxMembers <= 0 || s.redis == nil {
		return nil
	}

	participants, err := s.redis.GetVoiceChannelParticipants(channelID)
	if err != nil {
		return err
	}
	if s.redis.IsVoiceChannelParticipant(channelID, userID) {
		return nil
	}
	if len(participants) >= channel.MaxMembers {
		return ErrVoiceChannelFull
	}
	return nil
}
