package model

import "gorm.io/gorm"

// GroupRole represents a configurable identity group inside a channel group.
type GroupRole struct {
	gorm.Model
	GroupID     uint   `json:"groupId" gorm:"index;not null;uniqueIndex:idx_group_role_name"`
	Name        string `json:"name" gorm:"not null;uniqueIndex:idx_group_role_name"`
	Description string `json:"description"`
	Color       string `json:"color"`
	Position    int    `json:"position" gorm:"default:0"`
	IsDefault   bool   `json:"isDefault" gorm:"default:false"`
	IsSystem    bool   `json:"isSystem" gorm:"default:false"`
}

type GroupRoleResponse struct {
	ID          uint   `json:"id"`
	GroupID     uint   `json:"groupId"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Color       string `json:"color"`
	Position    int    `json:"position"`
	IsDefault   bool   `json:"isDefault"`
	IsSystem    bool   `json:"isSystem"`
}

func ToGroupRoleResponse(role GroupRole) GroupRoleResponse {
	return GroupRoleResponse{
		ID:          role.ID,
		GroupID:     role.GroupID,
		Name:        role.Name,
		Description: role.Description,
		Color:       role.Color,
		Position:    role.Position,
		IsDefault:   role.IsDefault,
		IsSystem:    role.IsSystem,
	}
}
