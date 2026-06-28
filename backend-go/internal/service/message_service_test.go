package service

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"chat-backend/internal/config"
	"chat-backend/internal/events"
	"chat-backend/internal/model"
	"chat-backend/internal/repository"

	"gorm.io/gorm"
)

func TestGetChannelMessagesUsesBoundedQueries(t *testing.T) {
	db := openServiceTestDB(t)
	prefix := fmt.Sprintf("msgq-%d-", time.Now().UnixNano())
	cleanupServiceTestData(t, db, prefix)

	owner := mustCreateUser(t, db, prefix+"owner")
	member := mustCreateUser(t, db, prefix+"member")
	bot := mustCreateUser(t, db, prefix+"bot")

	group := mustCreateGroup(t, db, prefix+"group", owner.ID)
	mustCreateChannels(t, db, group.ID, owner.ID)
	mustCreateMembership(t, db, owner.ID, group.ID, "owner")
	mustCreateMembership(t, db, member.ID, group.ID, "guest")
	mustCreateMembership(t, db, bot.ID, group.ID, AIBotRole)
	mustCreateAIConfig(t, db, group.ID, "https://example.test/v1", "sk-test", "gpt-test", "机器人")

	channel := mustFindTextChannel(t, db, group.ID, "general")

	for i := 0; i < 50; i++ {
		senderID := member.ID
		content := fmt.Sprintf("message-%02d", i)
		if i%10 == 0 {
			senderID = bot.ID
			content = fmt.Sprintf("bot-%02d", i)
		}
		mustCreateMessage(t, db, channel.ID, senderID, content)
	}

	counter := &queryCounterLogger{}
	countDB := db.Session(&gorm.Session{Logger: counter})
	service := newMessageServiceForTest(countDB)

	responses, err := service.GetChannelMessages(channel.ID, 50, 0, nil, nil, nil, "", nil)
	if err != nil {
		t.Fatalf("GetChannelMessages: %v", err)
	}
	if len(responses) != 50 {
		t.Fatalf("messages len = %d, want 50", len(responses))
	}

	if got := responses[0].Sender.GroupRole; got != AIBotRole {
		t.Fatalf("first message role = %q, want %q", got, AIBotRole)
	}
	if got := responses[0].Sender.Username; got != "机器人" {
		t.Fatalf("first bot username = %q, want %q", got, "机器人")
	}

	if counter.Count() > 7 {
		t.Fatalf("query count = %d, want <= 7", counter.Count())
	}
}

func TestAIReplyQueueCreatesFollowUpMessage(t *testing.T) {
	db := openServiceTestDB(t)
	prefix := fmt.Sprintf("aireply-%d-", time.Now().UnixNano())
	cleanupServiceTestData(t, db, prefix)

	owner := mustCreateUser(t, db, prefix+"owner")
	member := mustCreateUser(t, db, prefix+"member")
	bot := mustCreateUser(t, db, prefix+"bot")

	group := mustCreateGroup(t, db, prefix+"group", owner.ID)
	mustCreateChannels(t, db, group.ID, owner.ID)
	mustCreateMembership(t, db, owner.ID, group.ID, "owner")
	mustCreateMembership(t, db, member.ID, group.ID, "guest")
	mustCreateMembership(t, db, bot.ID, group.ID, AIBotRole)
	mustCreateAIConfig(t, db, group.ID, "http://127.0.0.1:0/v1", "", "gpt-test", "机器人")

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasSuffix(r.URL.Path, "/chat/completions") {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"队列回复"}}]}`))
	}))
	defer server.Close()

	_ = db.Model(&model.GroupAIConfig{}).Where("group_id = ?", group.ID).Updates(map[string]interface{}{
		"api_url":  server.URL + "/v1",
		"api_key":  "",
		"ai_model": "gpt-test",
		"bot_name": "机器人",
	}).Error

	channel := mustFindTextChannel(t, db, group.ID, "general")
	service := newMessageServiceForTest(db)
	service.aiService = NewAIService(configAIConfig(server.URL+"/v1", "", "gpt-test"))

	_, err := service.CreateMessage(CreateMessageInput{
		SenderID:  member.ID,
		ChannelID: channel.ID,
		Content:   "@机器人 今天有什么热点？",
	})
	if err != nil {
		t.Fatalf("CreateMessage: %v", err)
	}

	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		var count int64
		_ = db.Model(&model.Message{}).
			Where("channel_id = ? AND sender_id = ? AND content = ?", channel.ID, bot.ID, "队列回复").
			Count(&count).Error
		if count > 0 {
			return
		}
		time.Sleep(100 * time.Millisecond)
	}

	t.Fatalf("timed out waiting for AI reply message")
}

func TestIsSummarizeRequest(t *testing.T) {
	tests := []struct {
		content string
		want    bool
	}{
		{"@AI 总结聊天记录", true},
		{"@AI 总结聊天记录 今天", true},
		{"@AI 总结聊天记录 最近7天", true},
		{"@AI summarize messages", true},
		{"@AI 你好", false},
		{"@AI 今天天气如何", false},
		{"总结", false},
		{"summarize messages", true},
	}

	for _, tt := range tests {
		t.Run(tt.content, func(t *testing.T) {
			got := isSummarizeRequest(tt.content)
			if got != tt.want {
				t.Errorf("isSummarizeRequest(%q) = %v, want %v", tt.content, got, tt.want)
			}
		})
	}
}

func TestExtractSummarizeParams(t *testing.T) {
	tests := []struct {
		content    string
		wantPeriod string
	}{
		{"@AI 总结聊天记录", "today"},
		{"@AI 总结聊天记录 今天", "today"},
		{"@AI 总结聊天记录 最近7天", "last7days"},
		{"@AI 总结聊天记录 7天", "last7days"},
		{"@AI 总结聊天记录 最近30天", "last30days"},
		{"@AI 总结聊天记录 30天", "last30days"},
		{"@AI summarize messages today", "today"},
		{"@AI 总结", "today"},
	}

	for _, tt := range tests {
		t.Run(tt.content, func(t *testing.T) {
			period := extractSummarizeParams(tt.content)
			if period != tt.wantPeriod {
				t.Errorf("extractSummarizeParams(%q) period = %q, want %q", tt.content, period, tt.wantPeriod)
			}
		})
	}
}

func TestSummarizeChannelMessages(t *testing.T) {
	db := openServiceTestDB(t)
	prefix := fmt.Sprintf("summarize-%d-", time.Now().UnixNano())
	cleanupServiceTestData(t, db, prefix)

	owner := mustCreateUser(t, db, prefix+"owner")
	member := mustCreateUser(t, db, prefix+"member")
	bot := mustCreateUser(t, db, prefix+"bot")

	group := mustCreateGroup(t, db, prefix+"group", owner.ID)
	mustCreateChannels(t, db, group.ID, owner.ID)
	mustCreateMembership(t, db, owner.ID, group.ID, "owner")
	mustCreateMembership(t, db, member.ID, group.ID, "guest")
	mustCreateMembership(t, db, bot.ID, group.ID, AIBotRole)
	mustCreateAIConfig(t, db, group.ID, "https://example.test/v1", "sk-test", "gpt-test", "机器人")

	channel := mustFindTextChannel(t, db, group.ID, "general")

	// Create messages in the channel
	mustCreateMessage(t, db, channel.ID, member.ID, "Hello everyone")
	mustCreateMessage(t, db, channel.ID, owner.ID, "Welcome to the channel")
	mustCreateMessage(t, db, channel.ID, member.ID, "Let's discuss the project")

	service := newMessageServiceForTest(db)

	// Test "today" period
	prompt, err := service.summarizeChannelMessages(channel.ID, "today")
	if err != nil {
		t.Fatalf("summarizeChannelMessages(today): %v", err)
	}
	if !strings.Contains(prompt, "请总结以下聊天记录的主要内容和要点") {
		t.Errorf("prompt does not contain expected header")
	}
	if !strings.Contains(prompt, "Hello everyone") {
		t.Errorf("prompt does not contain member message")
	}
	if !strings.Contains(prompt, "Welcome to the channel") {
		t.Errorf("prompt does not contain owner message")
	}

	// Test empty messages
	prompt, err = service.summarizeChannelMessages(channel.ID, "last7days")
	if err != nil {
		t.Fatalf("summarizeChannelMessages(last7days): %v", err)
	}
	if !strings.Contains(prompt, "请总结以下聊天记录的主要内容和要点") {
		t.Errorf("prompt does not contain expected header")
	}
	if !strings.Contains(prompt, "Hello everyone") {
		t.Errorf("prompt does not contain member message")
	}
}

func TestSummarizeChannelMessagesNoMessages(t *testing.T) {
	db := openServiceTestDB(t)
	prefix := fmt.Sprintf("summarize-empty-%d-", time.Now().UnixNano())
	cleanupServiceTestData(t, db, prefix)

	owner := mustCreateUser(t, db, prefix+"owner")
	bot := mustCreateUser(t, db, prefix+"bot")

	group := mustCreateGroup(t, db, prefix+"group", owner.ID)
	mustCreateChannels(t, db, group.ID, owner.ID)
	mustCreateMembership(t, db, owner.ID, group.ID, "owner")
	mustCreateMembership(t, db, bot.ID, group.ID, AIBotRole)
	mustCreateAIConfig(t, db, group.ID, "https://example.test/v1", "sk-test", "gpt-test", "机器人")

	channel := mustFindTextChannel(t, db, group.ID, "general")

	service := newMessageServiceForTest(db)

	// Test with no messages - use a future period where no messages exist
	prompt, err := service.summarizeChannelMessages(channel.ID, "today")
	if err != nil {
		t.Fatalf("summarizeChannelMessages: %v", err)
	}
	if prompt != "该时间段内没有消息可总结。" {
		t.Errorf("expected no messages message, got: %q", prompt)
	}
}

func TestBuildAIReplySummarizeRequest(t *testing.T) {
	db := openServiceTestDB(t)
	prefix := fmt.Sprintf("aisummary-%d-", time.Now().UnixNano())
	cleanupServiceTestData(t, db, prefix)

	owner := mustCreateUser(t, db, prefix+"owner")
	member := mustCreateUser(t, db, prefix+"member")
	bot := mustCreateUser(t, db, prefix+"bot")

	group := mustCreateGroup(t, db, prefix+"group", owner.ID)
	mustCreateChannels(t, db, group.ID, owner.ID)
	mustCreateMembership(t, db, owner.ID, group.ID, "owner")
	mustCreateMembership(t, db, member.ID, group.ID, "guest")
	mustCreateMembership(t, db, bot.ID, group.ID, AIBotRole)
	mustCreateAIConfig(t, db, group.ID, "https://example.test/v1", "sk-test", "gpt-test", "机器人")

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasSuffix(r.URL.Path, "/chat/completions") {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"这是聊天记录的总结"}}]}`))
	}))
	defer server.Close()

	_ = db.Model(&model.GroupAIConfig{}).Where("group_id = ?", group.ID).Updates(map[string]interface{}{
		"api_url":  server.URL + "/v1",
		"api_key":  "",
		"ai_model": "gpt-test",
		"bot_name": "机器人",
	}).Error

	channel := mustFindTextChannel(t, db, group.ID, "general")

	// Create some messages to summarize
	mustCreateMessage(t, db, channel.ID, member.ID, "Message 1")
	mustCreateMessage(t, db, channel.ID, owner.ID, "Message 2")

	service := newMessageServiceForTest(db)
	service.aiService = NewAIService(configAIConfig(server.URL+"/v1", "", "gpt-test"))

	botUser, answer, err := service.buildAIReply(channel.ID, "@AI 总结聊天记录")
	if err != nil {
		t.Fatalf("buildAIReply: %v", err)
	}
	if botUser == nil {
		t.Fatal("expected bot user, got nil")
	}
	if answer != "这是聊天记录的总结" {
		t.Errorf("answer = %q, want %q", answer, "这是聊天记录的总结")
	}

	// Verify the AI summary message was NOT created in the database (buildAIReply doesn't create it)
	var count int64
	_ = db.Model(&model.Message{}).
		Where("channel_id = ? AND sender_id = ? AND content = ?", channel.ID, botUser.ID, "这是聊天记录的总结").
		Count(&count).Error
	if count != 0 {
		t.Errorf("expected 0 AI summary message (buildAIReply should not create message), got %d", count)
	}
}

func newMessageServiceForTest(db *gorm.DB) *MessageService {
	messageRepo := repository.NewMessageRepository(db)
	userRepo := repository.NewUserRepository(db)
	channelRepo := repository.NewChannelRepository(db)
	userGroupRepo := repository.NewUserGroupRepository(db)
	aiConfigRepo := repository.NewGroupAIConfigRepository(db)
	return NewMessageService(messageRepo, userRepo, channelRepo, userGroupRepo, aiConfigRepo, nil, events.NoopPublisher{})
}

func mustCreateUser(t *testing.T, db *gorm.DB, name string) model.User {
	t.Helper()
	user := model.User{
		Username: name,
		Email:    name + "@example.test",
		Password: "hashed",
		Avatar:   "U",
		Role:     "member",
		IsOnline: true,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user %s: %v", name, err)
	}
	return user
}

func mustCreateGroup(t *testing.T, db *gorm.DB, name string, ownerID uint) model.ChannelGroup {
	t.Helper()
	group := model.ChannelGroup{Name: name, OwnerID: ownerID, InviteCode: strings.ToUpper(name[:min(len(name), 12)])}
	if err := db.Create(&group).Error; err != nil {
		t.Fatalf("create group %s: %v", name, err)
	}
	return group
}

func mustCreateChannels(t *testing.T, db *gorm.DB, groupID, ownerID uint) {
	t.Helper()
	channels := []model.Channel{
		{Name: "general", Type: "text", Description: "General discussion", GroupID: groupID, Position: 0, CreatedBy: ownerID},
		{Name: "General Voice", Type: "voice", Description: "General voice chat", GroupID: groupID, Position: 0, CreatedBy: ownerID, MaxMembers: 100},
	}
	for i := range channels {
		if err := db.Create(&channels[i]).Error; err != nil {
			t.Fatalf("create channel %s: %v", channels[i].Name, err)
		}
	}
}

func mustCreateMembership(t *testing.T, db *gorm.DB, userID, groupID uint, role string) {
	t.Helper()
	userGroup := model.UserGroup{UserID: userID, GroupID: groupID, Role: role}
	if err := db.Create(&userGroup).Error; err != nil {
		t.Fatalf("create membership %d/%d: %v", userID, groupID, err)
	}
}

func mustCreateAIConfig(t *testing.T, db *gorm.DB, groupID uint, apiURL, apiKey, modelName, botName string) {
	t.Helper()
	cfg := model.GroupAIConfig{
		GroupID: groupID,
		APIURL:  apiURL,
		APIKey:  apiKey,
		AIModel: modelName,
		BotName: botName,
	}
	if err := db.Create(&cfg).Error; err != nil {
		t.Fatalf("create ai config: %v", err)
	}
}

func mustFindTextChannel(t *testing.T, db *gorm.DB, groupID uint, name string) model.Channel {
	t.Helper()
	var channel model.Channel
	if err := db.Where("group_id = ? AND name = ?", groupID, name).First(&channel).Error; err != nil {
		t.Fatalf("find channel %s: %v", name, err)
	}
	return channel
}

func mustCreateMessage(t *testing.T, db *gorm.DB, channelID, senderID uint, content string) {
	t.Helper()
	message := model.Message{ChannelID: channelID, SenderID: senderID, Content: content}
	if err := db.Create(&message).Error; err != nil {
		t.Fatalf("create message: %v", err)
	}
}

func configAIConfig(apiURL, apiKey, modelName string) config.AIConfig {
	return config.AIConfig{APIURL: apiURL, APIKey: apiKey, Model: modelName}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
