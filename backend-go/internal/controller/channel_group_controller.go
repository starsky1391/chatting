package controller

import (
	"errors"
	"strconv"

	"chat-backend/internal/service"
	"chat-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type ChannelGroupController struct {
	groupService *service.ChannelGroupService
}

func NewChannelGroupController(groupService *service.ChannelGroupService) *ChannelGroupController {
	return &ChannelGroupController{
		groupService: groupService,
	}
}

func (c *ChannelGroupController) GetAllGroups(ctx *gin.Context) {
	groups, err := c.groupService.GetAllGroups()
	if err != nil {
		response.InternalError(ctx, "Failed to get groups")
		return
	}

	response.Success(ctx, groups)
}

func (c *ChannelGroupController) GetGroupByID(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "Invalid group ID")
		return
	}

	group, err := c.groupService.GetGroupByID(uint(id))
	if err != nil {
		response.NotFound(ctx, "Group not found")
		return
	}

	response.Success(ctx, group)
}

func (c *ChannelGroupController) GetUserGroups(ctx *gin.Context) {
	userID := ctx.GetUint("userID")

	groups, err := c.groupService.GetUserGroups(userID)
	if err != nil {
		response.InternalError(ctx, "Failed to get user groups")
		return
	}

	response.Success(ctx, groups)
}

func (c *ChannelGroupController) CreateGroup(ctx *gin.Context) {
	userID := ctx.GetUint("userID")

	var input service.CreateGroupInput
	if err := ctx.ShouldBindJSON(&input); err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	group, err := c.groupService.CreateGroup(input, userID)
	if err != nil {
		response.InternalError(ctx, "Failed to create group")
		return
	}

	response.Created(ctx, group)
}

func (c *ChannelGroupController) UpdateGroup(ctx *gin.Context) {
	userID := ctx.GetUint("userID")

	id, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "Invalid group ID")
		return
	}

	var input service.UpdateGroupInput
	if err := ctx.ShouldBindJSON(&input); err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	group, err := c.groupService.UpdateGroup(uint(id), userID, input)
	if err != nil {
		if errors.Is(err, service.ErrNoPermission) {
			response.Forbidden(ctx, "You don't have permission to edit this group")
			return
		}
		response.InternalError(ctx, "Failed to update group")
		return
	}

	response.Success(ctx, group)
}

func (c *ChannelGroupController) JoinGroup(ctx *gin.Context) {
	userID := ctx.GetUint("userID")

	id, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "Invalid group ID")
		return
	}

	if err := c.groupService.JoinGroup(userID, uint(id)); err != nil {
		response.InternalError(ctx, "Failed to join group")
		return
	}

	// Return updated group with all channels
	group, _ := c.groupService.GetGroupByID(uint(id))
	response.Success(ctx, group)
}

func (c *ChannelGroupController) JoinGroupByInviteCode(ctx *gin.Context) {
	userID := ctx.GetUint("userID")
	inviteCode := ctx.Param("code")

	group, err := c.groupService.JoinGroupByInviteCode(userID, inviteCode)
	if err != nil {
		if err == service.ErrInvalidInviteCode {
			response.NotFound(ctx, "Invalid invite code")
			return
		}
		response.InternalError(ctx, "Failed to join group")
		return
	}

	response.Success(ctx, group)
}

func (c *ChannelGroupController) GetGroupByInviteCode(ctx *gin.Context) {
	inviteCode := ctx.Param("code")

	group, err := c.groupService.GetGroupByInviteCode(inviteCode)
	if err != nil {
		response.NotFound(ctx, "Invalid invite code")
		return
	}

	response.Success(ctx, group)
}

// GetGroupPreview returns group info with membership check for share links
func (c *ChannelGroupController) GetGroupPreview(ctx *gin.Context) {
	userID := ctx.GetUint("userID")
	inviteCode := ctx.Param("code")

	group, err := c.groupService.GetGroupPreviewByInviteCode(inviteCode, userID)
	if err != nil {
		response.NotFound(ctx, "Invalid invite code")
		return
	}

	response.Success(ctx, group)
}

func (c *ChannelGroupController) LeaveGroup(ctx *gin.Context) {
	userID := ctx.GetUint("userID")

	id, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "Invalid group ID")
		return
	}

	if err := c.groupService.LeaveGroup(userID, uint(id)); err != nil {
		response.InternalError(ctx, "Failed to leave group")
		return
	}

	response.SuccessWithMessage(ctx, nil, "Successfully left group")
}

func (c *ChannelGroupController) GetGroupMembers(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "Invalid group ID")
		return
	}

	members, err := c.groupService.GetGroupMembers(uint(id))
	if err != nil {
		response.InternalError(ctx, "Failed to get group members")
		return
	}

	response.Success(ctx, members)
}

func (c *ChannelGroupController) GetGroupRoles(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "Invalid group ID")
		return
	}

	roles, err := c.groupService.GetGroupRoles(uint(id))
	if err != nil {
		response.InternalError(ctx, "Failed to get group roles")
		return
	}
	response.Success(ctx, roles)
}

func (c *ChannelGroupController) CreateGroupRole(ctx *gin.Context) {
	userID := ctx.GetUint("userID")
	groupID, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "Invalid group ID")
		return
	}

	var input service.CreateGroupRoleInput
	if err := ctx.ShouldBindJSON(&input); err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	role, err := c.groupService.CreateGroupRole(uint(groupID), userID, input)
	if err != nil {
		if errors.Is(err, service.ErrNoPermission) {
			response.Forbidden(ctx, "You don't have permission to manage roles")
			return
		}
		response.BadRequest(ctx, err.Error())
		return
	}
	response.Created(ctx, role)
}

func (c *ChannelGroupController) UpdateGroupRole(ctx *gin.Context) {
	userID := ctx.GetUint("userID")
	groupID, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "Invalid group ID")
		return
	}
	roleID, err := strconv.ParseUint(ctx.Param("roleId"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "Invalid role ID")
		return
	}

	var input service.UpdateGroupRoleInput
	if err := ctx.ShouldBindJSON(&input); err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	role, err := c.groupService.UpdateGroupRole(uint(groupID), uint(roleID), userID, input)
	if err != nil {
		if errors.Is(err, service.ErrNoPermission) {
			response.Forbidden(ctx, "You don't have permission to manage roles")
			return
		}
		response.BadRequest(ctx, err.Error())
		return
	}
	response.Success(ctx, role)
}

func (c *ChannelGroupController) DeleteGroupRole(ctx *gin.Context) {
	userID := ctx.GetUint("userID")
	groupID, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "Invalid group ID")
		return
	}
	roleID, err := strconv.ParseUint(ctx.Param("roleId"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "Invalid role ID")
		return
	}

	if err := c.groupService.DeleteGroupRole(uint(groupID), uint(roleID), userID); err != nil {
		if errors.Is(err, service.ErrNoPermission) {
			response.Forbidden(ctx, "You don't have permission to manage roles")
			return
		}
		response.BadRequest(ctx, err.Error())
		return
	}
	response.SuccessWithMessage(ctx, nil, "Role deleted")
}

func (c *ChannelGroupController) UpdateMemberRole(ctx *gin.Context) {
	userID := ctx.GetUint("userID")
	groupID, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "Invalid group ID")
		return
	}
	targetUserID, err := strconv.ParseUint(ctx.Param("userId"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "Invalid user ID")
		return
	}

	var input service.UpdateMemberRoleInput
	if err := ctx.ShouldBindJSON(&input); err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	if err := c.groupService.AssignMemberRole(uint(groupID), uint(targetUserID), input.RoleID, userID); err != nil {
		if errors.Is(err, service.ErrNoPermission) {
			response.Forbidden(ctx, "You don't have permission to manage members")
			return
		}
		response.BadRequest(ctx, err.Error())
		return
	}
	response.SuccessWithMessage(ctx, nil, "Member role updated")
}

func (c *ChannelGroupController) GetChannelMembers(ctx *gin.Context) {
	channelID, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "Invalid channel ID")
		return
	}

	members, err := c.groupService.GetChannelMembers(uint(channelID))
	if err != nil {
		response.InternalError(ctx, "Failed to get channel members")
		return
	}

	response.Success(ctx, members)
}

func (c *ChannelGroupController) GetActiveChannelMembers(ctx *gin.Context) {
	channelID, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "Invalid channel ID")
		return
	}

	members, err := c.groupService.GetActiveChannelMembers(uint(channelID))
	if err != nil {
		response.InternalError(ctx, "Failed to get active channel members")
		return
	}

	response.Success(ctx, members)
}

func (c *ChannelGroupController) CreateChannel(ctx *gin.Context) {
	userID := ctx.GetUint("userID")

	groupID, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "Invalid group ID")
		return
	}

	var input service.CreateChannelInput
	if err := ctx.ShouldBindJSON(&input); err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	input.CreatedBy = userID
	input.GroupID = uint(groupID)

	channel, err := c.groupService.CreateChannel(input)
	if err != nil {
		if errors.Is(err, service.ErrChannelNameExists) {
			response.BadRequest(ctx, "Channel name already exists")
			return
		}
		response.InternalError(ctx, "Failed to create channel")
		return
	}

	response.Created(ctx, channel)
}

func (c *ChannelGroupController) GetGroupChannels(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "Invalid group ID")
		return
	}

	channels, err := c.groupService.GetChannelsByGroup(uint(id))
	if err != nil {
		response.InternalError(ctx, "Failed to get channels")
		return
	}

	response.Success(ctx, channels)
}

func (c *ChannelGroupController) UpdateChannel(ctx *gin.Context) {
	userID := ctx.GetUint("userID")

	channelID, err := strconv.ParseUint(ctx.Param("channelId"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "Invalid channel ID")
		return
	}

	var input service.UpdateChannelInput
	if err := ctx.ShouldBindJSON(&input); err != nil {
		response.BadRequest(ctx, err.Error())
		return
	}

	channel, err := c.groupService.UpdateChannel(uint(channelID), userID, input)
	if err != nil {
		if errors.Is(err, service.ErrNoPermission) {
			response.Forbidden(ctx, "You don't have permission to edit this channel")
			return
		}
		if errors.Is(err, service.ErrChannelNameExists) {
			response.BadRequest(ctx, "Channel name already exists")
			return
		}
		response.InternalError(ctx, "Failed to update channel")
		return
	}

	response.Success(ctx, channel)
}

func (c *ChannelGroupController) GetTextChannels(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "Invalid group ID")
		return
	}

	channels, err := c.groupService.GetTextChannels(uint(id))
	if err != nil {
		response.InternalError(ctx, "Failed to get text channels")
		return
	}

	response.Success(ctx, channels)
}

func (c *ChannelGroupController) GetVoiceChannels(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "Invalid group ID")
		return
	}

	channels, err := c.groupService.GetVoiceChannels(uint(id))
	if err != nil {
		response.InternalError(ctx, "Failed to get voice channels")
		return
	}

	response.Success(ctx, channels)
}

func (c *ChannelGroupController) DeleteChannel(ctx *gin.Context) {
	userID := ctx.GetUint("userID")

	channelID, err := strconv.ParseUint(ctx.Param("channelId"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "Invalid channel ID")
		return
	}

	if err := c.groupService.DeleteChannel(uint(channelID), userID); err != nil {
		if err == service.ErrNoPermission {
			response.Forbidden(ctx, "You don't have permission to delete this channel")
			return
		}
		response.InternalError(ctx, "Failed to delete channel")
		return
	}

	response.SuccessWithMessage(ctx, nil, "Channel deleted")
}

func (c *ChannelGroupController) DeleteGroup(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "Invalid group ID")
		return
	}

	if err := c.groupService.DeleteGroup(uint(id)); err != nil {
		response.InternalError(ctx, "Failed to delete group")
		return
	}

	response.SuccessWithMessage(ctx, nil, "Group deleted")
}

func (c *ChannelGroupController) GetVoiceParticipants(ctx *gin.Context) {
	channelID, err := strconv.ParseUint(ctx.Param("channelId"), 10, 32)
	if err != nil {
		response.BadRequest(ctx, "Invalid channel ID")
		return
	}

	participants, err := c.groupService.GetVoiceChannelParticipants(uint(channelID))
	if err != nil {
		response.InternalError(ctx, "Failed to get participants")
		return
	}

	response.Success(ctx, participants)
}
