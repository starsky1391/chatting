package controller

import (
	"fmt"
	"net/http"
	"os"

	"chat-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

// TokenGenerator 接口定义
type TokenGenerator interface {
	GenerateJoinToken(roomName string, participantName string, participantID string) (string, error)
}

// LiveKit 控制器
type LiveKitController struct {
	tokenGenerator TokenGenerator
	livekitUrl     string
}

func NewLiveKitController(tokenGen TokenGenerator, livekitUrl string) *LiveKitController {
	// 如果没有提供 URL，从环境变量读取或使用默认值
	if livekitUrl == "" {
		livekitUrl = os.Getenv("LIVEKIT_URL")
		if livekitUrl == "" {
			livekitUrl = "ws://localhost:7880" // 默认本地地址
		}
	}
	return &LiveKitController{
		tokenGenerator: tokenGen,
		livekitUrl:     livekitUrl,
	}
}

// 获取加入语音房间的 Token
// GET /api/livekit/token?room=channel-123
func (lc *LiveKitController) GetToken(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		response.Unauthorized(c, "未授权")
		return
	}

	roomName := c.Query("room")
	if roomName == "" {
		response.BadRequest(c, "缺少 room 参数")
		return
	}

	username, _ := c.Get("username")
	usernameStr, _ := username.(string)

	token, err := lc.tokenGenerator.GenerateJoinToken(
		roomName,
		usernameStr,
		fmt.Sprintf("%d", userID),
	)
	if err != nil {
		response.InternalError(c, "生成 Token 失败")
		return
	}

	// 动态生成 livekitUrl，从请求获取 Host
	scheme := "ws"
	if c.GetHeader("X-Forwarded-Proto") == "https" || c.Request.TLS != nil {
		scheme = "wss"
	}
	host := c.Request.Host
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
