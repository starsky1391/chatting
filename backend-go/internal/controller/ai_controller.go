package controller

import (
	"context"
	"time"

	"chat-backend/internal/service"
	"chat-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type AIController struct {
	aiService *service.AIService
}

func NewAIController(aiService *service.AIService) *AIController {
	return &AIController{aiService: aiService}
}

func (c *AIController) Ask(ctx *gin.Context) {
	var input service.AskAIInput
	if err := ctx.ShouldBindJSON(&input); err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	askCtx, cancel := context.WithTimeout(ctx.Request.Context(), 50*time.Second)
	defer cancel()

	answer, err := c.aiService.Ask(askCtx, input.Prompt)
	if err != nil && err != service.ErrAIAPIUnavailable {
		response.InternalError(ctx, "AI 接口调用失败")
		return
	}

	response.Success(ctx, service.AskAIResponse{Answer: answer})
}
