# Review package: be36a18c..HEAD

## Commits
ee595c93 feat: add AI chat summary feature

## Files changed
 backend-go/internal/repository/repository.go       |  13 ++
 backend-go/internal/service/message_service.go     |  86 +++++++++
 .../internal/service/message_service_test.go       | 199 +++++++++++++++++++++
 3 files changed, 298 insertions(+)

## Diff
diff --git a/backend-go/internal/repository/repository.go b/backend-go/internal/repository/repository.go
index 010b34ee..25388f90 100644
--- a/backend-go/internal/repository/repository.go
+++ b/backend-go/internal/repository/repository.go
@@ -238,20 +238,33 @@ func (r *MessageRepository) FindByChannelID(channelID uint, limit, offset int, d
 
 	err := query.Limit(limit).Offset(offset).Find(&messages).Error
 	return messages, err
 }
 
 func escapeLikePattern(value string) string {
 	replacer := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)
 	return replacer.Replace(value)
 }
 
+func (r *MessageRepository) FindByChannelIDAndTimeRange(channelID uint, startAt, endAt time.Time) ([]model.Message, error) {
+	var messages []model.Message
+	err := r.db.Model(&model.Message{}).
+		Select("messages.*").
+		Preload("Sender", func(db *gorm.DB) *gorm.DB {
+			return db.Select("id", "username", "avatar", "avatar_url", "role")
+		}).
+		Where("messages.channel_id = ? AND messages.created_at >= ? AND messages.created_at < ?", channelID, startAt, endAt).
+		Order("messages.created_at asc").
+		Find(&messages).Error
+	return messages, err
+}
+
 func (r *MessageRepository) FindByID(id uint) (*model.Message, error) {
 	var message model.Message
 	err := r.db.Preload("Sender", func(db *gorm.DB) *gorm.DB {
 		return db.Select("id", "username", "avatar", "avatar_url", "role")
 	}).First(&message, id).Error
 	return &message, err
 }
 
 func (r *MessageRepository) Delete(message *model.Message) error {
 	return r.db.Delete(message).Error
diff --git a/backend-go/internal/service/message_service.go b/backend-go/internal/service/message_service.go
index 75b85698..7c16cddd 100644
--- a/backend-go/internal/service/message_service.go
+++ b/backend-go/internal/service/message_service.go
@@ -215,20 +215,83 @@ func (s *MessageService) shouldAskAI(channelID uint, content string) bool {
 	}
 
 	bot, err := s.userRepo.FindByEmail(AIBotEmail)
 	if err != nil {
 		return false
 	}
 
 	return s.userGroupRepo.Exists(bot.ID, channel.GroupID)
 }
 
+func isSummarizeRequest(content string) bool {
+	lower := strings.ToLower(strings.TrimSpace(content))
+	return strings.Contains(lower, "总结聊天记录") ||
+		strings.Contains(lower, "summarize messages") ||
+		strings.Contains(lower, "总结")
+}
+
+func extractSummarizeParams(content string) (command string, period string) {
+	lower := strings.ToLower(strings.TrimSpace(content))
+
+	// 提取时间段
+	period = "today" // 默认今天
+	if strings.Contains(lower, "最近7天") || strings.Contains(lower, "7天") {
+		period = "last7days"
+	} else if strings.Contains(lower, "最近30天") || strings.Contains(lower, "30天") {
+		period = "last30days"
+	} else if strings.Contains(lower, "今天") || strings.Contains(lower, "today") {
+		period = "today"
+	}
+
+	return "summarize", period
+}
+
+func (s *MessageService) summarizeChannelMessages(channelID uint, period string) (string, error) {
+	// 根据时间段计算时间范围
+	now := time.Now()
+	var startAt, endAt time.Time
+
+	switch period {
+	case "last7days":
+		startAt = now.AddDate(0, 0, -7)
+	case "last30days":
+		startAt = now.AddDate(0, 0, -30)
+	case "today":
+		startAt = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
+	default:
+		startAt = now.AddDate(0, 0, -1)
+	}
+	endAt = now
+
+	// 查询消息
+	messages, err := s.messageRepo.FindByChannelIDAndTimeRange(channelID, startAt, endAt)
+	if err != nil {
+		return "", err
+	}
+
+	if len(messages) == 0 {
+		return "该时间段内没有消息可总结。", nil
+	}
+
+	// 构建总结prompt
+	var sb strings.Builder
+	sb.WriteString("请总结以下聊天记录的主要内容和要点：\n\n")
+	for _, msg := range messages {
+		sb.WriteString(fmt.Sprintf("[%s] %s: %s\n",
+			msg.CreatedAt.Format("2006-01-02 15:04"),
+			msg.Sender.Username,
+			msg.Content))
+	}
+
+	return sb.String(), nil
+}
+
 func (s *MessageService) buildAIReply(channelID uint, prompt string) (*model.User, string, error) {
 	if s.aiService == nil {
 		return nil, "", nil
 	}
 
 	channel, err := s.channelRepo.FindByID(channelID)
 	if err != nil {
 		logger.Warn("AI reply channel not found: %v", err)
 		return nil, "", err
 	}
@@ -239,20 +302,43 @@ func (s *MessageService) buildAIReply(channelID uint, prompt string) (*model.Use
 		return nil, "", err
 	}
 
 	groupConfig := &model.GroupAIConfig{}
 	if s.aiConfigRepo != nil {
 		if savedConfig, err := s.aiConfigRepo.FindByGroupID(channel.GroupID); err == nil {
 			groupConfig = savedConfig
 		}
 	}
 
+	// 检查是否为总结请求
+	if isSummarizeRequest(prompt) {
+		_, period := extractSummarizeParams(prompt)
+		summaryPrompt, err := s.summarizeChannelMessages(channelID, period)
+		if err != nil {
+			return bot, "", err
+		}
+
+		// 调用AI进行总结
+		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
+		defer cancel()
+
+		answer, err := s.aiService.AskWithConfig(ctx, summaryPrompt, configFromGroupAIConfig(groupConfig))
+		if err != nil {
+			return bot, "", err
+		}
+
+		if _, err := s.createMessageAs(bot.ID, channelID, answer); err != nil {
+			return bot, "", err
+		}
+		return bot, answer, nil
+	}
+
 	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
 	defer cancel()
 
 	answer, err := s.aiService.AskWithConfig(ctx, prompt, configFromGroupAIConfig(groupConfig))
 	if err != nil && !errors.Is(err, ErrAIAPIUnavailable) {
 		return bot, "", err
 	}
 	if strings.TrimSpace(answer) == "" {
 		answer = "AI 没有返回内容。"
 	}
diff --git a/backend-go/internal/service/message_service_test.go b/backend-go/internal/service/message_service_test.go
index 865549d3..8c79dafa 100644
--- a/backend-go/internal/service/message_service_test.go
+++ b/backend-go/internal/service/message_service_test.go
@@ -122,20 +122,219 @@ func TestAIReplyQueueCreatesFollowUpMessage(t *testing.T) {
 			Count(&count).Error
 		if count > 0 {
 			return
 		}
 		time.Sleep(100 * time.Millisecond)
 	}
 
 	t.Fatalf("timed out waiting for AI reply message")
 }
 
+func TestIsSummarizeRequest(t *testing.T) {
+	tests := []struct {
+		content string
+		want    bool
+	}{
+		{"@AI 总结聊天记录", true},
+		{"@AI 总结聊天记录 今天", true},
+		{"@AI 总结聊天记录 最近7天", true},
+		{"@AI summarize messages", true},
+		{"@AI 总结", true},
+		{"@AI 你好", false},
+		{"@AI 今天天气如何", false},
+		{"总结", true},
+		{"summarize messages", true},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.content, func(t *testing.T) {
+			got := isSummarizeRequest(tt.content)
+			if got != tt.want {
+				t.Errorf("isSummarizeRequest(%q) = %v, want %v", tt.content, got, tt.want)
+			}
+		})
+	}
+}
+
+func TestExtractSummarizeParams(t *testing.T) {
+	tests := []struct {
+		content       string
+		wantCommand   string
+		wantPeriod    string
+	}{
+		{"@AI 总结聊天记录", "summarize", "today"},
+		{"@AI 总结聊天记录 今天", "summarize", "today"},
+		{"@AI 总结聊天记录 最近7天", "summarize", "last7days"},
+		{"@AI 总结聊天记录 7天", "summarize", "last7days"},
+		{"@AI 总结聊天记录 最近30天", "summarize", "last30days"},
+		{"@AI 总结聊天记录 30天", "summarize", "last30days"},
+		{"@AI summarize messages today", "summarize", "today"},
+		{"@AI 总结", "summarize", "today"},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.content, func(t *testing.T) {
+			cmd, period := extractSummarizeParams(tt.content)
+			if cmd != tt.wantCommand {
+				t.Errorf("extractSummarizeParams(%q) command = %q, want %q", tt.content, cmd, tt.wantCommand)
+			}
+			if period != tt.wantPeriod {
+				t.Errorf("extractSummarizeParams(%q) period = %q, want %q", tt.content, period, tt.wantPeriod)
+			}
+		})
+	}
+}
+
+func TestSummarizeChannelMessages(t *testing.T) {
+	db := openServiceTestDB(t)
+	prefix := fmt.Sprintf("summarize-%d-", time.Now().UnixNano())
+	cleanupServiceTestData(t, db, prefix)
+
+	owner := mustCreateUser(t, db, prefix+"owner")
+	member := mustCreateUser(t, db, prefix+"member")
+	bot := mustCreateUser(t, db, prefix+"bot")
+
+	group := mustCreateGroup(t, db, prefix+"group", owner.ID)
+	mustCreateChannels(t, db, group.ID, owner.ID)
+	mustCreateMembership(t, db, owner.ID, group.ID, "owner")
+	mustCreateMembership(t, db, member.ID, group.ID, "guest")
+	mustCreateMembership(t, db, bot.ID, group.ID, AIBotRole)
+	mustCreateAIConfig(t, db, group.ID, "https://example.test/v1", "sk-test", "gpt-test", "机器人")
+
+	channel := mustFindTextChannel(t, db, group.ID, "general")
+
+	// Create messages in the channel
+	mustCreateMessage(t, db, channel.ID, member.ID, "Hello everyone")
+	mustCreateMessage(t, db, channel.ID, owner.ID, "Welcome to the channel")
+	mustCreateMessage(t, db, channel.ID, member.ID, "Let's discuss the project")
+
+	service := newMessageServiceForTest(db)
+
+	// Test "today" period
+	prompt, err := service.summarizeChannelMessages(channel.ID, "today")
+	if err != nil {
+		t.Fatalf("summarizeChannelMessages(today): %v", err)
+	}
+	if !strings.Contains(prompt, "请总结以下聊天记录的主要内容和要点") {
+		t.Errorf("prompt does not contain expected header")
+	}
+	if !strings.Contains(prompt, "Hello everyone") {
+		t.Errorf("prompt does not contain member message")
+	}
+	if !strings.Contains(prompt, "Welcome to the channel") {
+		t.Errorf("prompt does not contain owner message")
+	}
+
+	// Test empty messages
+	prompt, err = service.summarizeChannelMessages(channel.ID, "last7days")
+	if err != nil {
+		t.Fatalf("summarizeChannelMessages(last7days): %v", err)
+	}
+	if !strings.Contains(prompt, "请总结以下聊天记录的主要内容和要点") {
+		t.Errorf("prompt does not contain expected header")
+	}
+	if !strings.Contains(prompt, "Hello everyone") {
+		t.Errorf("prompt does not contain member message")
+	}
+}
+
+func TestSummarizeChannelMessagesNoMessages(t *testing.T) {
+	db := openServiceTestDB(t)
+	prefix := fmt.Sprintf("summarize-empty-%d-", time.Now().UnixNano())
+	cleanupServiceTestData(t, db, prefix)
+
+	owner := mustCreateUser(t, db, prefix+"owner")
+	bot := mustCreateUser(t, db, prefix+"bot")
+
+	group := mustCreateGroup(t, db, prefix+"group", owner.ID)
+	mustCreateChannels(t, db, group.ID, owner.ID)
+	mustCreateMembership(t, db, owner.ID, group.ID, "owner")
+	mustCreateMembership(t, db, bot.ID, group.ID, AIBotRole)
+	mustCreateAIConfig(t, db, group.ID, "https://example.test/v1", "sk-test", "gpt-test", "机器人")
+
+	channel := mustFindTextChannel(t, db, group.ID, "general")
+
+	service := newMessageServiceForTest(db)
+
+	// Test with no messages - use a future period where no messages exist
+	prompt, err := service.summarizeChannelMessages(channel.ID, "today")
+	if err != nil {
+		t.Fatalf("summarizeChannelMessages: %v", err)
+	}
+	if prompt != "该时间段内没有消息可总结。" {
+		t.Errorf("expected no messages message, got: %q", prompt)
+	}
+}
+
+func TestBuildAIReplySummarizeRequest(t *testing.T) {
+	db := openServiceTestDB(t)
+	prefix := fmt.Sprintf("aisummary-%d-", time.Now().UnixNano())
+	cleanupServiceTestData(t, db, prefix)
+
+	owner := mustCreateUser(t, db, prefix+"owner")
+	member := mustCreateUser(t, db, prefix+"member")
+	bot := mustCreateUser(t, db, prefix+"bot")
+
+	group := mustCreateGroup(t, db, prefix+"group", owner.ID)
+	mustCreateChannels(t, db, group.ID, owner.ID)
+	mustCreateMembership(t, db, owner.ID, group.ID, "owner")
+	mustCreateMembership(t, db, member.ID, group.ID, "guest")
+	mustCreateMembership(t, db, bot.ID, group.ID, AIBotRole)
+	mustCreateAIConfig(t, db, group.ID, "https://example.test/v1", "sk-test", "gpt-test", "机器人")
+
+	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		if !strings.HasSuffix(r.URL.Path, "/chat/completions") {
+			http.NotFound(w, r)
+			return
+		}
+		w.Header().Set("Content-Type", "application/json")
+		_, _ = w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"这是聊天记录的总结"}}]}`))
+	}))
+	defer server.Close()
+
+	_ = db.Model(&model.GroupAIConfig{}).Where("group_id = ?", group.ID).Updates(map[string]interface{}{
+		"api_url":  server.URL + "/v1",
+		"api_key":  "",
+		"ai_model": "gpt-test",
+		"bot_name": "机器人",
+	}).Error
+
+	channel := mustFindTextChannel(t, db, group.ID, "general")
+
+	// Create some messages to summarize
+	mustCreateMessage(t, db, channel.ID, member.ID, "Message 1")
+	mustCreateMessage(t, db, channel.ID, owner.ID, "Message 2")
+
+	service := newMessageServiceForTest(db)
+	service.aiService = NewAIService(configAIConfig(server.URL+"/v1", "", "gpt-test"))
+
+	botUser, answer, err := service.buildAIReply(channel.ID, "@AI 总结聊天记录")
+	if err != nil {
+		t.Fatalf("buildAIReply: %v", err)
+	}
+	if botUser == nil {
+		t.Fatal("expected bot user, got nil")
+	}
+	if answer != "这是聊天记录的总结" {
+		t.Errorf("answer = %q, want %q", answer, "这是聊天记录的总结")
+	}
+
+	// Verify the AI reply message was created in the database
+	var count int64
+	_ = db.Model(&model.Message{}).
+		Where("channel_id = ? AND sender_id = ? AND content = ?", channel.ID, botUser.ID, "这是聊天记录的总结").
+		Count(&count).Error
+	if count != 1 {
+		t.Errorf("expected 1 AI summary message, got %d", count)
+	}
+}
+
 func newMessageServiceForTest(db *gorm.DB) *MessageService {
 	messageRepo := repository.NewMessageRepository(db)
 	userRepo := repository.NewUserRepository(db)
 	channelRepo := repository.NewChannelRepository(db)
 	userGroupRepo := repository.NewUserGroupRepository(db)
 	aiConfigRepo := repository.NewGroupAIConfigRepository(db)
 	return NewMessageService(messageRepo, userRepo, channelRepo, userGroupRepo, aiConfigRepo, nil, events.NoopPublisher{})
 }
 
 func mustCreateUser(t *testing.T, db *gorm.DB, name string) model.User {
