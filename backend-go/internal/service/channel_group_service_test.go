package service

import (
	"errors"
	"fmt"
	"testing"
	"time"

	"chat-backend/internal/repository"

	"gorm.io/gorm"
)

func TestCreateGroupAddsDefaultChannels(t *testing.T) {
	db := openServiceTestDB(t)
	prefix := fmt.Sprintf("group-%d-", time.Now().UnixNano())
	cleanupServiceTestData(t, db, prefix)

	owner := mustCreateUser(t, db, prefix+"owner")
	svc := newChannelGroupServiceForTest(db)

	group, err := svc.CreateGroup(CreateGroupInput{
		Name:        prefix + "guild",
		Description: "test group",
	}, owner.ID)
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}

	if got := len(group.TextChannels); got != 1 {
		t.Fatalf("text channels = %d, want 1", got)
	}
	if got := len(group.VoiceChannels); got != 1 {
		t.Fatalf("voice channels = %d, want 1", got)
	}
	if group.TextChannels[0].CreatedBy != owner.ID {
		t.Fatalf("default text channel createdBy = %d, want %d", group.TextChannels[0].CreatedBy, owner.ID)
	}
	if group.VoiceChannels[0].CreatedBy != owner.ID {
		t.Fatalf("default voice channel createdBy = %d, want %d", group.VoiceChannels[0].CreatedBy, owner.ID)
	}
}

func TestGroupAIConfigPermissionIsOwnerOnly(t *testing.T) {
	db := openServiceTestDB(t)
	prefix := fmt.Sprintf("aiperm-%d-", time.Now().UnixNano())
	cleanupServiceTestData(t, db, prefix)

	owner := mustCreateUser(t, db, prefix+"owner")
	member := mustCreateUser(t, db, prefix+"member")
	group := mustCreateGroup(t, db, prefix+"group", owner.ID)
	mustCreateMembership(t, db, owner.ID, group.ID, "owner")
	mustCreateMembership(t, db, member.ID, group.ID, "guest")

	svc := newChannelGroupServiceForTest(db)

	if _, err := svc.SaveGroupAIConfig(group.ID, member.ID, UpdateGroupAIConfigInput{
		APIURL: "https://example.test/v1",
		Model:  "gpt-test",
	}); !errors.Is(err, ErrNoPermission) {
		t.Fatalf("SaveGroupAIConfig by member error = %v, want ErrNoPermission", err)
	}

	if _, err := svc.SaveGroupAIConfig(group.ID, owner.ID, UpdateGroupAIConfigInput{
		APIURL:  "https://example.test/v1",
		APIKey:  "sk-test",
		Model:   "gpt-test",
		BotName: "机器人",
	}); err != nil {
		t.Fatalf("SaveGroupAIConfig by owner: %v", err)
	}

	cfg, err := svc.GetGroupAIConfig(group.ID, owner.ID)
	if err != nil {
		t.Fatalf("GetGroupAIConfig: %v", err)
	}
	if cfg.BotName != "机器人" {
		t.Fatalf("botName = %q, want %q", cfg.BotName, "机器人")
	}

	if err := svc.DeleteGroupAIConfig(group.ID, member.ID); !errors.Is(err, ErrNoPermission) {
		t.Fatalf("DeleteGroupAIConfig by member error = %v, want ErrNoPermission", err)
	}
}

func newChannelGroupServiceForTest(db *gorm.DB) *ChannelGroupService {
	groupRepo := repository.NewChannelGroupRepository(db)
	channelRepo := repository.NewChannelRepository(db)
	userRepo := repository.NewUserRepository(db)
	userGroupRepo := repository.NewUserGroupRepository(db)
	groupRoleRepo := repository.NewGroupRoleRepository(db)
	aiConfigRepo := repository.NewGroupAIConfigRepository(db)
	return NewChannelGroupService(groupRepo, channelRepo, userRepo, userGroupRepo, groupRoleRepo, aiConfigRepo, nil)
}

func TestNormalizeAIBotName(t *testing.T) {
	if got := normalizeAIBotName("  "); got != AIBotUsername {
		t.Fatalf("normalizeAIBotName empty = %q, want %q", got, AIBotUsername)
	}
	if got := normalizeAIBotName("  机器人 "); got != "机器人" {
		t.Fatalf("normalizeAIBotName = %q, want %q", got, "机器人")
	}
}

func TestMentionsAIUsesCustomBotName(t *testing.T) {
	if !mentionsAI("请问@小智今天有啥热点", "小智") {
		t.Fatal("mentionsAI should match custom bot name")
	}
	if mentionsAI("普通消息", "小智") {
		t.Fatal("mentionsAI should not match normal text")
	}
}
