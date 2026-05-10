package model

import (
	"fmt"
	"time"

	"gorm.io/gorm"
)

// User model with extended profile fields
type User struct {
	gorm.Model
	Username  string `json:"username" gorm:"uniqueIndex;not null"`
	Email     string `json:"email" gorm:"uniqueIndex;not null"`
	Password  string `json:"-" gorm:"not null"`
	Avatar    string `json:"avatar"`
	AvatarURL string `json:"avatarUrl"`
	Role      string `json:"role" gorm:"default:'member'"`
	Bio       string `json:"bio"`
	// Online status tracking via heartbeat
	LastSeen  *time.Time `json:"lastSeen"`
	IsOnline  bool       `json:"isOnline" gorm:"default:false"`
}

// ChannelGroup represents a server/guild with multiple channels
type ChannelGroup struct {
	gorm.Model
	Name        string     `json:"name" gorm:"not null"`
	Description string     `json:"description"`
	Icon        string     `json:"icon"`
	OwnerID     uint       `json:"ownerId"`
	Owner       User       `json:"owner"`
	InviteCode  string     `json:"inviteCode" gorm:"size:12;uniqueIndex"`
	Channels    []Channel  `json:"channels" gorm:"foreignKey:GroupID"`
}

// Channel model with group support
type Channel struct {
	gorm.Model
	Name        string `json:"name" gorm:"not null;uniqueIndex:idx_channel_group_name"`
	Type        string `json:"type" gorm:"default:'text'"` // text or voice
	Description string `json:"description"`
	GroupID     uint   `json:"groupId" gorm:"uniqueIndex:idx_channel_group_name"`
	Group       ChannelGroup `json:"group"`
	Position    int    `json:"position"` // Order within group
	CreatedBy   uint   `json:"createdBy"` // Creator user ID (0 = system created)
}

// Message model
type Message struct {
	gorm.Model
	Content   string `json:"content"`
	SenderID  uint   `json:"sender_id"`
	Sender    User   `json:"sender"`
	ChannelID uint   `json:"channel_id"`
	Channel   Channel `json:"channel"`
}

// UserChannel for membership tracking
type UserChannel struct {
	gorm.Model
	UserID    uint `json:"user_id"`
	User      User `json:"user"`
	ChannelID uint `json:"channel_id"`
	Channel   Channel `json:"channel"`
}

// UserGroup for group membership
type UserGroup struct {
	gorm.Model
	UserID    uint `json:"user_id"`
	User      User `json:"user"`
	GroupID   uint `json:"group_id"`
	Group     ChannelGroup `json:"group"`
	Role      string `json:"role" gorm:"default:'member'"` // owner, admin, moderator, member
}

// DTO for API responses
type MessageResponse struct {
	ID        uint      `json:"id"`
	Content   ContentResponse `json:"content"`
	Sender    SenderResponse `json:"sender"`
	CreatedAt time.Time `json:"createdAt"`
}

type ContentResponse struct {
	Type string `json:"type"`
	Body string `json:"body"`
}

type SenderResponse struct {
	ID       uint   `json:"id"`
	Username string `json:"username"`
	Avatar   string `json:"avatar"`
	AvatarURL string `json:"avatarUrl"`
}

type UserResponse struct {
	ID        uint       `json:"id"`
	Username  string     `json:"username"`
	Email     string     `json:"email"`
	Avatar    string     `json:"avatar"`
	AvatarURL string     `json:"avatarUrl"`
	Role      string     `json:"role"`
	Bio       string     `json:"bio"`
	IsOnline  bool       `json:"isOnline"`
	LastSeen  *time.Time `json:"lastSeen"`
}

type ChannelGroupResponse struct {
	ID            uint              `json:"id"`
	Name          string            `json:"name"`
	Description   string            `json:"description"`
	Icon          string            `json:"icon"`
	OwnerID       uint              `json:"ownerId"`
	InviteCode    string            `json:"inviteCode"`
	InviteLink    string            `json:"inviteLink"` // format: CODE#OWNER_ID
	TextChannels  []ChannelResponse `json:"textChannels"`
	VoiceChannels []ChannelResponse `json:"voiceChannels"`
	Members       []UserResponse    `json:"members"`
	IsMember      bool              `json:"isMember"` // whether the requesting user is a member
	MemberCount   int               `json:"memberCount"`
}

type ChannelResponse struct {
	ID          uint   `json:"id"`
	Name        string `json:"name"`
	Type        string `json:"type"`
	Description string `json:"description"`
	GroupId     uint   `json:"groupId"`
	Position    int    `json:"position"`
	CreatedBy   uint   `json:"createdBy"`
}

func ToMessageResponse(msg Message) MessageResponse {
	return MessageResponse{
		ID: msg.ID,
		Content: ContentResponse{
			Type: "text",
			Body: msg.Content,
		},
		Sender: SenderResponse{
			ID:        msg.Sender.ID,
			Username:  msg.Sender.Username,
			Avatar:    msg.Sender.Avatar,
			AvatarURL: msg.Sender.AvatarURL,
		},
		CreatedAt: msg.CreatedAt,
	}
}

func ToUserResponse(user User) UserResponse {
	return UserResponse{
		ID:        user.ID,
		Username:  user.Username,
		Email:     user.Email,
		Avatar:    user.Avatar,
		AvatarURL: user.AvatarURL,
		Role:      user.Role,
		Bio:       user.Bio,
		IsOnline:  user.IsOnline,
		LastSeen:  user.LastSeen,
	}
}

func ToChannelResponse(channel Channel) ChannelResponse {
	return ChannelResponse{
		ID:          channel.ID,
		Name:        channel.Name,
		Type:        channel.Type,
		Description: channel.Description,
		GroupId:     channel.GroupID,
		Position:    channel.Position,
		CreatedBy:   channel.CreatedBy,
	}
}

func ToChannelGroupResponse(group ChannelGroup) ChannelGroupResponse {
	textChannels := make([]ChannelResponse, 0)
	voiceChannels := make([]ChannelResponse, 0)

	for _, ch := range group.Channels {
		if ch.Type == "text" {
			textChannels = append(textChannels, ToChannelResponse(ch))
		} else {
			voiceChannels = append(voiceChannels, ToChannelResponse(ch))
		}
	}

	return ChannelGroupResponse{
		ID:            group.ID,
		Name:          group.Name,
		Description:   group.Description,
		Icon:          group.Icon,
		OwnerID:       group.OwnerID,
		InviteCode:    group.InviteCode,
		InviteLink:    fmt.Sprintf("%s#%d", group.InviteCode, group.OwnerID),
		TextChannels:  textChannels,
		VoiceChannels: voiceChannels,
		IsMember:      false, // Default, should be set by caller if needed
		MemberCount:   0,     // Default, should be set by caller if needed
	}
}