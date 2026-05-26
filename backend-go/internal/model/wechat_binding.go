package model

import (
	"time"

	"gorm.io/gorm"
)

// WechatBinding 微信账号绑定表
type WechatBinding struct {
	gorm.Model
	UserID  uint   `gorm:"not null;uniqueIndex;column:user_id" json:"user_id"`
	OpenID  string `gorm:"size:64;not null;uniqueIndex;column:openid" json:"openid"`
	UnionID string `gorm:"size:64;column:unionid" json:"unionid"`

	// 关联用户
	User User `gorm:"foreignKey:UserID" json:"user"`
}

func (WechatBinding) TableName() string {
	return "wechat_bindings"
}

// WechatBindingResponse 微信绑定响应
type WechatBindingResponse struct {
	ID        uint      `json:"id"`
	UserID    uint      `json:"userId"`
	OpenID    string    `json:"openid"`
	CreatedAt time.Time `json:"createdAt"`
}