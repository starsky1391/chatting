package controller

import (
	"strconv"

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

	messages, err := c.messageService.GetChannelMessages(uint(channelID), limit, offset)
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