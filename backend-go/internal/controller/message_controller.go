package controller

import (
	"errors"
	"strconv"
	"time"

	"chat-backend/internal/service"
	"chat-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type MessageController struct {
	messageService *service.MessageService
}

func NewMessageController(messageService *service.MessageService) *MessageController {
	return &MessageController{
		messageService: messageService,
	}
}

func (c *MessageController) GetChannelMessages(ctx *gin.Context) {
	channelID, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "Invalid channel ID")
		return
	}

	limit, _ := strconv.Atoi(ctx.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(ctx.DefaultQuery("offset", "0"))
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}
	if offset < 0 {
		offset = 0
	}

	var day *time.Time
	var startAt *time.Time
	var endAt *time.Time
	if startQuery := ctx.Query("startAt"); startQuery != "" {
		parsed, parseErr := time.Parse(time.RFC3339, startQuery)
		if parseErr != nil {
			response.BadRequest(ctx, "Invalid startAt, expected RFC3339")
			return
		}
		startAt = &parsed
	}
	if endQuery := ctx.Query("endAt"); endQuery != "" {
		parsed, parseErr := time.Parse(time.RFC3339, endQuery)
		if parseErr != nil {
			response.BadRequest(ctx, "Invalid endAt, expected RFC3339")
			return
		}
		endAt = &parsed
	}
	if dateQuery := ctx.Query("date"); dateQuery != "" {
		parsed, parseErr := time.ParseInLocation("2006-01-02", dateQuery, time.Local)
		if parseErr != nil {
			response.BadRequest(ctx, "Invalid date, expected YYYY-MM-DD")
			return
		}
		day = &parsed
	}

	messages, err := c.messageService.GetChannelMessages(uint(channelID), limit, offset, day, startAt, endAt)
	if err != nil {
		response.InternalError(ctx, "Failed to get messages")
		return
	}

	response.Success(ctx, messages)
}

func (c *MessageController) CreateMessage(ctx *gin.Context) {
	userID := ctx.GetUint("userID")

	channelID, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "Invalid channel ID")
		return
	}

	var input struct {
		Content string `json:"content" binding:"required"`
	}
	if err := ctx.ShouldBindJSON(&input); err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	message, err := c.messageService.CreateMessage(service.CreateMessageInput{
		Content:   input.Content,
		SenderID:  userID,
		ChannelID: uint(channelID),
	})
	if err != nil {
		response.InternalError(ctx, "Failed to create message")
		return
	}

	response.Created(ctx, message)
}

func (c *MessageController) RecallMessage(ctx *gin.Context) {
	userID := ctx.GetUint("userID")

	channelID, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "Invalid channel ID")
		return
	}

	messageID, err := strconv.ParseUint(ctx.Param("messageId"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "Invalid message ID")
		return
	}

	err = c.messageService.RecallMessage(uint(channelID), uint(messageID), userID)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrMessageNotOwned):
			response.Error(ctx, 403, "只能撤回自己发送的消息")
		case errors.Is(err, service.ErrMessageRecallWindow):
			response.Error(ctx, 400, "消息已超过 30 秒，不能撤回")
		case errors.Is(err, service.ErrMessageChannelScope):
			response.Error(ctx, 400, "消息不属于当前频道")
		default:
			response.NotFound(ctx, "Message not found")
		}
		return
	}

	response.Success(ctx, gin.H{"messageId": messageID})
}

func (c *MessageController) GetMessageByID(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "Invalid message ID")
		return
	}

	message, err := c.messageService.GetMessageByID(uint(id))
	if err != nil {
		response.NotFound(ctx, "Message not found")
		return
	}

	response.Success(ctx, message)
}
