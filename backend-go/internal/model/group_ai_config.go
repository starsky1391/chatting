package model

import (
	"time"

	"gorm.io/gorm"
)

// GroupAIConfig stores the AI bot endpoint owned by one group.
type GroupAIConfig struct {
	gorm.Model
	GroupID uint         `json:"groupId" gorm:"not null;uniqueIndex"`
	Group   ChannelGroup `json:"group"`
	APIURL  string       `json:"apiUrl" gorm:"not null"`
	APIKey  string       `json:"apiKey"`
	AIModel string       `json:"model"`
	BotName string       `json:"botName" gorm:"default:'AI'"`
}

type GroupAIConfigResponse struct {
	GroupID   uint      `json:"groupId"`
	APIURL    string    `json:"apiUrl"`
	APIKey    string    `json:"apiKey"`
	Model     string    `json:"model"`
	BotName   string    `json:"botName"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func ToGroupAIConfigResponse(config GroupAIConfig) GroupAIConfigResponse {
	return GroupAIConfigResponse{
		GroupID:   config.GroupID,
		APIURL:    config.APIURL,
		APIKey:    config.APIKey,
		Model:     config.AIModel,
		BotName:   config.BotName,
		UpdatedAt: config.UpdatedAt,
	}
}
