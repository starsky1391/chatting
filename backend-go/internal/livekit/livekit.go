package livekit

import (
	"time"

	"github.com/livekit/protocol/auth"
)

// LiveKit 配置
type Config struct {
	Host      string // LiveKit 服务器地址，如 "ws://livekit:7880"
	APIKey    string // API Key
	APISecret string // API Secret
}

// Token 生成器
type TokenGenerator struct {
	config Config
}

func NewTokenGenerator(config Config) *TokenGenerator {
	return &TokenGenerator{config: config}
}

// 生成加入房间的 Token
func (tg *TokenGenerator) GenerateJoinToken(roomName string, participantName string, participantID string) (string, error) {
	at := auth.NewAccessToken(tg.config.APIKey, tg.config.APISecret)

	grant := &auth.VideoGrant{
		RoomJoin: true,
		Room:     roomName,
	}

	at.AddGrant(grant).
		SetIdentity(participantID).
		SetName(participantName).
		SetValidFor(time.Hour) // Token 有效期 1 小时

	return at.ToJWT()
}
