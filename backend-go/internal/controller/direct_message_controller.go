package controller

import (
	"errors"
	"strconv"

	"chat-backend/internal/service"
	"chat-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type DirectMessageController struct {
	directMessageService *service.DirectMessageService
}

func NewDirectMessageController(directMessageService *service.DirectMessageService) *DirectMessageController {
	return &DirectMessageController{directMessageService: directMessageService}
}

func (c *DirectMessageController) ListConversations(ctx *gin.Context) {
	userID := ctx.GetUint("userID")
	conversations, err := c.directMessageService.ListConversations(userID)
	if err != nil {
		response.InternalError(ctx, "Failed to get conversations")
		return
	}
	response.Success(ctx, conversations)
}

func (c *DirectMessageController) CreateConversation(ctx *gin.Context) {
	userID := ctx.GetUint("userID")

	var input service.CreateDirectConversationInput
	if err := ctx.ShouldBindJSON(&input); err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	conversation, err := c.directMessageService.GetOrCreateConversation(userID, input.UserID)
	if err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}
	response.Created(ctx, conversation)
}

func (c *DirectMessageController) GetConversation(ctx *gin.Context) {
	userID := ctx.GetUint("userID")
	conversationID, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "Invalid conversation ID")
		return
	}

	conversation, err := c.directMessageService.GetConversation(userID, uint(conversationID))
	if err != nil {
		response.NotFound(ctx, "Conversation not found")
		return
	}
	response.Success(ctx, conversation)
}

func (c *DirectMessageController) ListMessages(ctx *gin.Context) {
	userID := ctx.GetUint("userID")
	conversationID, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "Invalid conversation ID")
		return
	}

	limit, _ := strconv.Atoi(ctx.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(ctx.DefaultQuery("offset", "0"))
	messages, err := c.directMessageService.ListMessages(userID, uint(conversationID), limit, offset)
	if err != nil {
		response.NotFound(ctx, "Conversation not found")
		return
	}
	response.Success(ctx, messages)
}

func (c *DirectMessageController) CreateMessage(ctx *gin.Context) {
	userID := ctx.GetUint("userID")
	conversationID, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "Invalid conversation ID")
		return
	}

	var input service.CreateDirectMessageInput
	if err := ctx.ShouldBindJSON(&input); err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	message, err := c.directMessageService.CreateMessage(userID, uint(conversationID), input)
	if err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}
	response.Created(ctx, message)
}

func (c *DirectMessageController) RecallMessage(ctx *gin.Context) {
	userID := ctx.GetUint("userID")
	conversationID, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "Invalid conversation ID")
		return
	}
	messageID, err := strconv.ParseUint(ctx.Param("messageId"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "Invalid message ID")
		return
	}

	err = c.directMessageService.RecallMessage(userID, uint(conversationID), uint(messageID))
	if err != nil {
		switch {
		case errors.Is(err, service.ErrMessageNotOwned):
			response.Error(ctx, 403, "只能撤回自己发送的消息")
		case errors.Is(err, service.ErrMessageRecallWindow):
			response.Error(ctx, 400, "消息已超过 30 秒，不能撤回")
		case errors.Is(err, service.ErrDirectMessageConversationScope):
			response.Error(ctx, 400, "消息不属于当前私信会话")
		default:
			response.NotFound(ctx, "私信消息不存在")
		}
		return
	}

	response.SuccessWithMessage(ctx, nil, "消息已撤回")
}
