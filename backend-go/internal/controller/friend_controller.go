package controller

import (
	"strconv"

	"chat-backend/internal/service"
	"chat-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type FriendController struct {
	friendService *service.FriendService
}

func NewFriendController(friendService *service.FriendService) *FriendController {
	return &FriendController{friendService: friendService}
}

func (c *FriendController) SearchUsers(ctx *gin.Context) {
	userID := ctx.GetUint("userID")
	users, err := c.friendService.SearchUsers(ctx.Query("q"), userID)
	if err != nil {
		response.InternalError(ctx, "Failed to search users")
		return
	}
	response.Success(ctx, users)
}

func (c *FriendController) CreateFriendRequest(ctx *gin.Context) {
	userID := ctx.GetUint("userID")

	var input service.CreateFriendRequestInput
	if err := ctx.ShouldBindJSON(&input); err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	req, err := c.friendService.CreateFriendRequest(userID, input)
	if err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}
	response.Created(ctx, req)
}

func (c *FriendController) ListIncomingRequests(ctx *gin.Context) {
	userID := ctx.GetUint("userID")
	requests, err := c.friendService.ListIncomingRequests(userID)
	if err != nil {
		response.InternalError(ctx, "Failed to get friend requests")
		return
	}
	response.Success(ctx, requests)
}

func (c *FriendController) ListOutgoingRequests(ctx *gin.Context) {
	userID := ctx.GetUint("userID")
	requests, err := c.friendService.ListOutgoingRequests(userID)
	if err != nil {
		response.InternalError(ctx, "Failed to get friend requests")
		return
	}
	response.Success(ctx, requests)
}

func (c *FriendController) AcceptRequest(ctx *gin.Context) {
	userID := ctx.GetUint("userID")
	requestID, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "Invalid request ID")
		return
	}

	req, err := c.friendService.AcceptRequest(userID, uint(requestID))
	if err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}
	response.Success(ctx, req)
}

func (c *FriendController) RejectRequest(ctx *gin.Context) {
	userID := ctx.GetUint("userID")
	requestID, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "Invalid request ID")
		return
	}

	req, err := c.friendService.RejectRequest(userID, uint(requestID))
	if err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}
	response.Success(ctx, req)
}

func (c *FriendController) ListFriends(ctx *gin.Context) {
	userID := ctx.GetUint("userID")
	friends, err := c.friendService.ListFriends(userID)
	if err != nil {
		response.InternalError(ctx, "Failed to get friends")
		return
	}
	response.Success(ctx, friends)
}

func (c *FriendController) RemoveFriend(ctx *gin.Context) {
	userID := ctx.GetUint("userID")
	friendID, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "Invalid friend ID")
		return
	}

	if err := c.friendService.RemoveFriend(userID, uint(friendID)); err != nil {
		response.InternalError(ctx, "Failed to remove friend")
		return
	}
	response.SuccessWithMessage(ctx, nil, "Friend removed")
}
