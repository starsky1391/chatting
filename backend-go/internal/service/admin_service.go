package service

import (
	"errors"
	"time"

	"chat-backend/internal/model"

	"gorm.io/gorm"
)

type AdminService struct {
	db *gorm.DB
}

func NewAdminService(db *gorm.DB) *AdminService {
	return &AdminService{db: db}
}

type AdminSummary struct {
	Users                 int64 `json:"users"`
	OnlineUsers           int64 `json:"onlineUsers"`
	Groups                int64 `json:"groups"`
	Channels              int64 `json:"channels"`
	Messages              int64 `json:"messages"`
	DirectConversations   int64 `json:"directConversations"`
	DirectMessages        int64 `json:"directMessages"`
	PendingFriendRequests int64 `json:"pendingFriendRequests"`
}

type AdminUserRow struct {
	ID        uint       `json:"id"`
	Username  string     `json:"username"`
	Email     string     `json:"email"`
	Role      string     `json:"role"`
	IsOnline  bool       `json:"isOnline"`
	LastSeen  *time.Time `json:"lastSeen"`
	CreatedAt time.Time  `json:"createdAt"`
}

type AdminGroupRow struct {
	ID          uint      `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	OwnerID     uint      `json:"ownerId"`
	OwnerName   string    `json:"ownerName"`
	InviteCode  string    `json:"inviteCode"`
	Channels    int64     `json:"channels"`
	Members     int64     `json:"members"`
	CreatedAt   time.Time `json:"createdAt"`
}

type AdminMessageRow struct {
	ID          uint      `json:"id"`
	Content     string    `json:"content"`
	SenderID    uint      `json:"senderId"`
	SenderName  string    `json:"senderName"`
	ChannelID   uint      `json:"channelId"`
	ChannelName string    `json:"channelName"`
	CreatedAt   time.Time `json:"createdAt"`
}

type AdminDirectMessageRow struct {
	ID             uint      `json:"id"`
	Content        string    `json:"content"`
	SenderID       uint      `json:"senderId"`
	SenderName     string    `json:"senderName"`
	ConversationID uint      `json:"conversationId"`
	MemberNames    []string  `json:"memberNames"`
	CreatedAt      time.Time `json:"createdAt"`
}

type UpdateUserRoleInput struct {
	Role string `json:"role" binding:"required,oneof=admin moderator member"`
}

func (s *AdminService) Summary() (*AdminSummary, error) {
	var summary AdminSummary
	counts := []struct {
		model interface{}
		out   *int64
		where string
		args  []interface{}
	}{
		{&model.User{}, &summary.Users, "", nil},
		{&model.User{}, &summary.OnlineUsers, "is_online = ?", []interface{}{true}},
		{&model.ChannelGroup{}, &summary.Groups, "", nil},
		{&model.Channel{}, &summary.Channels, "", nil},
		{&model.Message{}, &summary.Messages, "", nil},
		{&model.DirectConversation{}, &summary.DirectConversations, "", nil},
		{&model.DirectMessage{}, &summary.DirectMessages, "", nil},
		{&model.FriendRequest{}, &summary.PendingFriendRequests, "status = ?", []interface{}{"pending"}},
	}

	for _, item := range counts {
		query := s.db.Model(item.model)
		if item.where != "" {
			query = query.Where(item.where, item.args...)
		}
		if err := query.Count(item.out).Error; err != nil {
			return nil, err
		}
	}

	return &summary, nil
}

func (s *AdminService) ListUsers(limit int) ([]AdminUserRow, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}

	var users []model.User
	if err := s.db.Order("created_at desc").Limit(limit).Find(&users).Error; err != nil {
		return nil, err
	}

	rows := make([]AdminUserRow, 0, len(users))
	for _, user := range users {
		rows = append(rows, AdminUserRow{
			ID:        user.ID,
			Username:  user.Username,
			Email:     user.Email,
			Role:      user.Role,
			IsOnline:  user.IsOnline,
			LastSeen:  user.LastSeen,
			CreatedAt: user.CreatedAt,
		})
	}
	return rows, nil
}

func (s *AdminService) UpdateUserRole(userID uint, role string) error {
	return s.db.Model(&model.User{}).Where("id = ?", userID).Update("role", role).Error
}

func (s *AdminService) DeleteUser(currentUserID, targetUserID uint) error {
	if currentUserID == targetUserID {
		return errors.New("cannot delete current admin user")
	}
	return s.db.Delete(&model.User{}, targetUserID).Error
}

func (s *AdminService) ListGroups(limit int) ([]AdminGroupRow, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}

	var groups []model.ChannelGroup
	if err := s.db.Preload("Owner").Order("created_at desc").Limit(limit).Find(&groups).Error; err != nil {
		return nil, err
	}

	rows := make([]AdminGroupRow, 0, len(groups))
	for _, group := range groups {
		var channels int64
		var members int64
		s.db.Model(&model.Channel{}).Where("group_id = ?", group.ID).Count(&channels)
		s.db.Model(&model.UserGroup{}).Where("group_id = ?", group.ID).Count(&members)

		rows = append(rows, AdminGroupRow{
			ID:          group.ID,
			Name:        group.Name,
			Description: group.Description,
			OwnerID:     group.OwnerID,
			OwnerName:   group.Owner.Username,
			InviteCode:  group.InviteCode,
			Channels:    channels,
			Members:     members,
			CreatedAt:   group.CreatedAt,
		})
	}
	return rows, nil
}

func (s *AdminService) DeleteGroup(groupID uint) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Unscoped().Where("group_id = ?", groupID).Delete(&model.UserGroup{}).Error; err != nil {
			return err
		}
		if err := tx.Unscoped().
			Where("channel_id IN (?)", tx.Model(&model.Channel{}).Select("id").Where("group_id = ?", groupID)).
			Delete(&model.Message{}).Error; err != nil {
			return err
		}
		if err := tx.Unscoped().Where("group_id = ?", groupID).Delete(&model.Channel{}).Error; err != nil {
			return err
		}
		return tx.Unscoped().Delete(&model.ChannelGroup{}, groupID).Error
	})
}

func (s *AdminService) ListMessages(limit int) ([]AdminMessageRow, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}

	var messages []model.Message
	if err := s.db.Preload("Sender").Preload("Channel").Order("created_at desc").Limit(limit).Find(&messages).Error; err != nil {
		return nil, err
	}

	rows := make([]AdminMessageRow, 0, len(messages))
	for _, message := range messages {
		rows = append(rows, AdminMessageRow{
			ID:          message.ID,
			Content:     message.Content,
			SenderID:    message.SenderID,
			SenderName:  message.Sender.Username,
			ChannelID:   message.ChannelID,
			ChannelName: message.Channel.Name,
			CreatedAt:   message.CreatedAt,
		})
	}
	return rows, nil
}

func (s *AdminService) DeleteMessage(messageID uint) error {
	return s.db.Delete(&model.Message{}, messageID).Error
}

func (s *AdminService) ListDirectMessages(limit int) ([]AdminDirectMessageRow, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}

	var messages []model.DirectMessage
	if err := s.db.Preload("Sender").
		Preload("Conversation.Members").
		Order("created_at desc").
		Limit(limit).
		Find(&messages).Error; err != nil {
		return nil, err
	}

	rows := make([]AdminDirectMessageRow, 0, len(messages))
	for _, message := range messages {
		memberNames := make([]string, 0, len(message.Conversation.Members))
		for _, member := range message.Conversation.Members {
			memberNames = append(memberNames, member.Username)
		}

		rows = append(rows, AdminDirectMessageRow{
			ID:             message.ID,
			Content:        message.Content,
			SenderID:       message.SenderID,
			SenderName:     message.Sender.Username,
			ConversationID: message.ConversationID,
			MemberNames:    memberNames,
			CreatedAt:      message.CreatedAt,
		})
	}
	return rows, nil
}

func (s *AdminService) DeleteDirectMessage(messageID uint) error {
	return s.db.Delete(&model.DirectMessage{}, messageID).Error
}
