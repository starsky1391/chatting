## Task 1: AI总结指令识别与消息查询

**Files:**
- Modify: `backend-go/internal/service/message_service.go`

**Interfaces:**
- Consumes: 现有 `shouldAskAI`, `extractAIPrompt`, `buildAIReply` 方法
- Produces: `summarizeChannelMessages` 方法, 增强的AI指令识别

- [ ] **Step 1: 在 `shouldAskAI` 中识别总结指令**

在 `mentionsAI` 函数后添加总结指令识别：

```go
func isSummarizeRequest(content string) bool {
	lower := strings.ToLower(strings.TrimSpace(content))
	return strings.Contains(lower, "总结聊天记录") ||
		strings.Contains(lower, "summarize messages") ||
		strings.Contains(lower, "总结")
}
```

- [ ] **Step 2: 在 `extractAIPrompt` 中提取时间段参数**

```go
func extractSummarizeParams(content string) (command string, period string) {
	lower := strings.ToLower(strings.TrimSpace(content))
	
	// 提取时间段
	period = "today" // 默认今天
	if strings.Contains(lower, "最近7天") || strings.Contains(lower, "7天") {
		period = "last7days"
	} else if strings.Contains(lower, "最近30天") || strings.Contains(lower, "30天") {
		period = "last30days"
	} else if strings.Contains(lower, "今天") || strings.Contains(lower, "today") {
		period = "today"
	}
	
	return "summarize", period
}
```

- [ ] **Step 3: 新增 `summarizeChannelMessages` 方法**

```go
func (s *MessageService) summarizeChannelMessages(channelID uint, period string) (string, error) {
	// 根据时间段计算时间范围
	now := time.Now()
	var startAt, endAt time.Time
	
	switch period {
	case "last7days":
		startAt = now.AddDate(0, 0, -7)
	case "last30days":
		startAt = now.AddDate(0, 0, -30)
	case "today":
		startAt = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	default:
		startAt = now.AddDate(0, 0, -1)
	}
	endAt = now
	
	// 查询消息
	messages, err := s.messageRepo.FindByChannelIDAndTimeRange(channelID, startAt, endAt)
	if err != nil {
		return "", err
	}
	
	if len(messages) == 0 {
		return "该时间段内没有消息可总结。", nil
	}
	
	// 构建总结prompt
	var sb strings.Builder
	sb.WriteString("请总结以下聊天记录的主要内容和要点：\n\n")
	for _, msg := range messages {
		sb.WriteString(fmt.Sprintf("[%s] %s: %s\n", 
			msg.CreatedAt.Format("2006-01-02 15:04"),
			msg.Sender.Username,
			msg.Content))
	}
	
	return sb.String(), nil
}
```

- [ ] **Step 4: 修改 `buildAIReply` 处理总结指令**

```go
func (s *MessageService) buildAIReply(channelID uint, prompt string) (*model.User, string, error) {
	// ... 现有代码 ...
	
	// 检查是否为总结请求
	if isSummarizeRequest(prompt) {
		_, period := extractSummarizeParams(prompt)
		summaryPrompt, err := s.summarizeChannelMessages(channelID, period)
		if err != nil {
			return bot, "", err
		}
		
		// 调用AI进行总结
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()
		
		answer, err := s.aiService.AskWithConfig(ctx, summaryPrompt, configFromGroupAIConfig(groupConfig))
		if err != nil {
			return bot, "", err
		}
		
		if _, err := s.createMessageAs(bot.ID, channelID, answer); err != nil {
			return bot, "", err
		}
		return bot, answer, nil
	}
	
	// ... 现有AI回复逻辑 ...
}
```

- [ ] **Step 5: Commit**

```bash
git add backend-go/internal/service/message_service.go
git commit -m "feat: add AI chat summary feature"
```

---

