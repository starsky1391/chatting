package controller

import (
	"errors"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"

	"chat-backend/internal/service"
	"chat-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

// TokenGenerator 接口定义
type TokenGenerator interface {
	GenerateJoinToken(roomName string, participantName string, participantID string) (string, error)
}

type VoiceJoinValidator interface {
	ValidateVoiceChannelJoin(channelID uint, userID uint) error
}

// LiveKit 控制器
type LiveKitController struct {
	tokenGenerator TokenGenerator
	voiceValidator VoiceJoinValidator
	livekitUrl     string
}

func NewLiveKitController(tokenGen TokenGenerator, voiceValidator VoiceJoinValidator, livekitUrl string) *LiveKitController {
	// 如果没有提供 URL，从环境变量读取或使用默认值
	if livekitUrl == "" {
		livekitUrl = os.Getenv("LIVEKIT_URL")
		if livekitUrl == "" {
			livekitUrl = "ws://localhost:7880" // 默认本地地址
		}
	}
	return &LiveKitController{
		tokenGenerator: tokenGen,
		voiceValidator: voiceValidator,
		livekitUrl:     livekitUrl,
	}
}

// 获取加入语音房间的 Token
// GET /api/livekit/token?room=channel-123
func (lc *LiveKitController) GetToken(c *gin.Context) {
	_, exists := c.Get("userID")
	if !exists {
		response.Unauthorized(c, "未授权")
		return
	}
	userIDUint := c.GetUint("userID")

	roomName := c.Query("room")
	if roomName == "" {
		response.BadRequest(c, "缺少 room 参数")
		return
	}
	if lc.voiceValidator != nil {
		channelID, err := parseLiveKitChannelRoom(roomName)
		if err != nil {
			response.BadRequest(c, "无效的语音频道")
			return
		}
		if err := lc.voiceValidator.ValidateVoiceChannelJoin(channelID, userIDUint); err != nil {
			if errors.Is(err, service.ErrVoiceChannelFull) {
				response.Error(c, http.StatusConflict, "语音频道人数已满")
				return
			}
			if errors.Is(err, service.ErrNoPermission) {
				response.Forbidden(c, "你没有权限加入这个语音频道")
				return
			}
			if errors.Is(err, service.ErrNotVoiceChannel) {
				response.BadRequest(c, "这不是语音频道")
				return
			}
			response.InternalError(c, "无法加入语音频道")
			return
		}
	}

	username, _ := c.Get("username")
	usernameStr, _ := username.(string)

	token, err := lc.tokenGenerator.GenerateJoinToken(
		roomName,
		usernameStr,
		fmt.Sprintf("%d", userIDUint),
	)
	if err != nil {
		response.InternalError(c, "生成 Token 失败")
		return
	}

	// 动态生成 livekitUrl，从反向代理传入的 Host 获取浏览器可访问地址。
	scheme := "ws"
	if c.GetHeader("X-Forwarded-Proto") == "https" || c.Request.TLS != nil {
		scheme = "wss"
	}
	host := c.GetHeader("X-Forwarded-Host")
	if host == "" {
		host = c.Request.Host
	}
	livekitUrl := fmt.Sprintf("%s://%s/livekit", scheme, host)

	response.Success(c, gin.H{
		"token":      token,
		"livekitUrl": livekitUrl,
	})
}

// Webhook 接收 LiveKit 事件
// POST /api/livekit/webhook
func (lc *LiveKitController) Webhook(c *gin.Context) {
	// TODO: 验证签名并处理事件
	// 暂时只返回成功
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func parseLiveKitChannelRoom(roomName string) (uint, error) {
	idText := strings.TrimPrefix(roomName, "channel-")
	if idText == roomName || idText == "" {
		return 0, errors.New("invalid room name")
	}
	id, err := strconv.ParseUint(idText, 10, 32)
	return uint(id), err
}
