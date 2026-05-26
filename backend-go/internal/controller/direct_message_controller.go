package controller

import (
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
