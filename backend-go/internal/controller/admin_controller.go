package controller

import (
	"strconv"

	"chat-backend/internal/service"
	"chat-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type AdminController struct {
	adminService *service.AdminService
}

func NewAdminController(adminService *service.AdminService) *AdminController {
	return &AdminController{adminService: adminService}
}

func (c *AdminController) Summary(ctx *gin.Context) {
	summary, err := c.adminService.Summary()
	if err != nil {
		response.InternalError(ctx, "Failed to get admin summary")
		return
	}
	response.Success(ctx, summary)
}

func (c *AdminController) ListUsers(ctx *gin.Context) {
	limit := parseLimit(ctx)
	users, err := c.adminService.ListUsers(limit)
	if err != nil {
		response.InternalError(ctx, "Failed to get users")
		return
	}
	response.Success(ctx, users)
}

func (c *AdminController) UpdateUserRole(ctx *gin.Context) {
	userID, err := parseUintParam(ctx, "id")
	if err != nil {
		response.BadRequest(ctx, "Invalid user ID")
		return
	}

	var input service.UpdateUserRoleInput
	if err := ctx.ShouldBindJSON(&input); err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	if err := c.adminService.UpdateUserRole(userID, input.Role); err != nil {
		response.InternalError(ctx, "Failed to update user role")
		return
	}
	response.SuccessWithMessage(ctx, nil, "User role updated")
}

func (c *AdminController) DeleteUser(ctx *gin.Context) {
	userID, err := parseUintParam(ctx, "id")
	if err != nil {
		response.BadRequest(ctx, "Invalid user ID")
		return
	}

	if err := c.adminService.DeleteUser(ctx.GetUint("userID"), userID); err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}
	response.SuccessWithMessage(ctx, nil, "User deleted")
}

func (c *AdminController) ListGroups(ctx *gin.Context) {
	groups, err := c.adminService.ListGroups(parseLimit(ctx))
	if err != nil {
		response.InternalError(ctx, "Failed to get groups")
		return
	}
	response.Success(ctx, groups)
}

func (c *AdminController) DeleteGroup(ctx *gin.Context) {
	groupID, err := parseUintParam(ctx, "id")
	if err != nil {
		response.BadRequest(ctx, "Invalid group ID")
		return
	}

	if err := c.adminService.DeleteGroup(groupID); err != nil {
		response.InternalError(ctx, "Failed to delete group")
		return
	}
	response.SuccessWithMessage(ctx, nil, "Group deleted")
}

func (c *AdminController) ListMessages(ctx *gin.Context) {
	messages, err := c.adminService.ListMessages(parseLimit(ctx))
	if err != nil {
		response.InternalError(ctx, "Failed to get messages")
		return
	}
	response.Success(ctx, messages)
}

func (c *AdminController) DeleteMessage(ctx *gin.Context) {
	messageID, err := parseUintParam(ctx, "id")
	if err != nil {
		response.BadRequest(ctx, "Invalid message ID")
		return
	}

	if err := c.adminService.DeleteMessage(messageID); err != nil {
		response.InternalError(ctx, "Failed to delete message")
		return
	}
	response.SuccessWithMessage(ctx, nil, "Message deleted")
}

func (c *AdminController) ListDirectMessages(ctx *gin.Context) {
	messages, err := c.adminService.ListDirectMessages(parseLimit(ctx))
	if err != nil {
		response.InternalError(ctx, "Failed to get direct messages")
		return
	}
	response.Success(ctx, messages)
}

func (c *AdminController) DeleteDirectMessage(ctx *gin.Context) {
	messageID, err := parseUintParam(ctx, "id")
	if err != nil {
		response.BadRequest(ctx, "Invalid direct message ID")
		return
	}

	if err := c.adminService.DeleteDirectMessage(messageID); err != nil {
		response.InternalError(ctx, "Failed to delete direct message")
		return
	}
	response.SuccessWithMessage(ctx, nil, "Direct message deleted")
}

func parseLimit(ctx *gin.Context) int {
	limit, err := strconv.Atoi(ctx.DefaultQuery("limit", "100"))
	if err != nil {
		return 100
	}
	return limit
}

func parseUintParam(ctx *gin.Context, key string) (uint, error) {
	id, err := strconv.ParseUint(ctx.Param(key), 10, 32)
	return uint(id), err
}
