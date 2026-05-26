package controller

import (
	"chat-backend/internal/config"
	"chat-backend/internal/middleware"
	"chat-backend/internal/service"
	"chat-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type WechatController struct {
	wechatService *service.WechatService
	cfg           *config.Config
}

func NewWechatController(wechatService *service.WechatService, cfg *config.Config) *WechatController {
	return &WechatController{
		wechatService: wechatService,
		cfg:           cfg,
	}
}

// Login 处理微信小程序登录
func (c *WechatController) Login(ctx *gin.Context) {
	var input service.WechatLoginInput
	if err := ctx.ShouldBindJSON(&input); err != nil {
		response.BadRequest(ctx, "参数错误: "+err.Error())
		return
	}

	result, err := c.wechatService.Login(input)
	if err != nil {
		response.Error(ctx, 400, err.Error())
		return
	}

	// Generate token
	token, err := middleware.GenerateToken(result.User.ID, result.User.Username, c.cfg)
	if err != nil {
		response.InternalError(ctx, "Failed to generate token")
		return
	}
	result.AccessToken = token

	response.Success(ctx, result)
}