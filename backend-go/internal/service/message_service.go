package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"chat-backend/internal/config"
	"chat-backend/internal/events"
	"chat-backend/internal/model"
	"chat-backend/internal/repository"
	"chat-backend/pkg/logger"
)

var (
	ErrMessageNotOwned     = errors.New("message is not owned by current user")
	ErrMessageRecallWindow = errors.New("message recall window has expired")
	ErrMessageChannelScope = errors.New("message does not belong to channel")
)

type MessageService struct {
	messageRepo   *repository.MessageRepository
	userRepo      *repository.UserRepository
	channelRepo   *repository.ChannelRepository
	userGroupRepo *repository.UserGroupRepository
	aiConfigRepo  *repository.GroupAIConfigRepository
	aiService     *AIService
	publisher     events.Publisher
	aiReplyQueue  chan aiReplyJob
}

func NewMessageService(
	messageRepo *repository.MessageRepository,
	userRepo *repository.UserRepository,
	channelRepo *repository.ChannelRepository,
	userGroupRepo *repository.UserGroupRepository,
	aiConfigRepo *repository.GroupAIConfigRepository,
	aiService *AIService,
	publisher events.Publisher,
) *MessageService {
	if publisher == nil {
		publisher = events.NoopPublisher{}
	}
	service := &MessageService{
		messageRepo:   messageRepo,
		userRepo:      userRepo,
		channelRepo:   channelRepo,
		userGroupRepo: userGroupRepo,
		aiConfigRepo:  aiConfigRepo,
		aiService:     aiService,
		publisher:     publisher,
		aiReplyQueue:  make(chan aiReplyJob, 64),
	}
	service.startAIReplyWorkers(2)
	return service
}

type aiReplyJob struct {
	channelID uint
	prompt    string
	attempt   int
}

const aiReplyMaxAttempts = 3

type CreateMessageInput struct {
	Content   string `json:"content" binding:"required"`
	SenderID  uint   `json:"senderId"`
	ChannelID uint   `json:"channelId"`
}

func (s *MessageService) CreateMessage(input CreateMessageInput) (*model.MessageResponse, error) {
	response, err := s.createMessageAs(input.SenderID, input.ChannelID, input.Content)
	if err != nil {
		return nil, err
	}

	if s.shouldAskAI(input.ChannelID, input.Content) {
		prompt := extractAIPrompt(input.Content)
		s.enqueueAIReply(input.ChannelID, prompt)
	}

	return response, nil
}

func (s *MessageService) startAIReplyWorkers(workerCount int) {
	if s == nil || s.aiReplyQueue == nil || workerCount <= 0 {
		return
	}

	for i := 0; i < workerCount; i++ {
		go func() {
			for job := range s.aiReplyQueue {
				s.handleAIReplyJob(job)
			}
		}()
	}
}

func (s *MessageService) enqueueAIReply(channelID uint, prompt string) {
	if s == nil || s.aiReplyQueue == nil {
		go s.handleAIReplyJob(aiReplyJob{channelID: channelID, prompt: prompt})
		return
	}

	job := aiReplyJob{channelID: channelID, prompt: prompt}
	select {
	case s.aiReplyQueue <- job:
	default:
		logger.Warn("AI reply queue is full, dropping job for channel %d", channelID)
		go s.handleAIReplyJob(job)
	}
}

func (s *MessageService) enqueueAIReplyRetry(job aiReplyJob) {
	if s == nil || s.aiReplyQueue == nil {
		go s.handleAIReplyJob(job)
		return
	}

	select {
	case s.aiReplyQueue <- job:
	default:
		go s.handleAIReplyJob(job)
	}
}

func (s *MessageService) handleAIReplyJob(job aiReplyJob) {
	bot, answer, err := s.buildAIReply(job.channelID, job.prompt)
	if err == nil {
		return
	}

	if errors.Is(err, ErrAIAPIUnavailable) {
		if strings.TrimSpace(answer) != "" && bot != nil {
			if _, postErr := s.createMessageAs(bot.ID, job.channelID, answer); postErr != nil {
				logger.Warn("Failed to post unavailable AI reply: %v", postErr)
			}
		}
		return
	}

	if job.attempt+1 < aiReplyMaxAttempts {
		nextJob := job
		nextJob.attempt++
		delay := time.Duration(job.attempt+1) * 500 * time.Millisecond
		time.AfterFunc(delay, func() {
			s.enqueueAIReplyRetry(nextJob)
		})
		return
	}

	if bot != nil {
		failure := fmt.Sprintf("AI 回复失败：%s", err.Error())
		if strings.TrimSpace(failure) != "" {
			if _, postErr := s.createMessageAs(bot.ID, job.channelID, failure); postErr != nil {
				logger.Warn("Failed to post AI failure reply: %v", postErr)
			}
		}
	}
	logger.Warn("AI reply failed after retries: %v", err)
}

func (s *MessageService) createMessageAs(senderID, channelID uint, content string) (*model.MessageResponse, error) {
	message := &model.Message{
		Content:   content,
		SenderID:  senderID,
		ChannelID: channelID,
	}

	if err := s.messageRepo.Create(message); err != nil {
		return nil, err
	}

	// Load sender info
	user, err := s.userRepo.FindByID(senderID)
	if err != nil {
		return nil, err
	}
	message.Sender = *user

	response := model.ToMessageResponse(*message)
	s.decorateChannelMessageResponse(&response, channelID)
	events.DispatchChannelMessageCreatedToGlobalHub(channelID, response)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := s.publisher.PublishChannelMessageCreated(ctx, channelID, response); err != nil {
		logger.Warn("Failed to publish channel message event: %v", err)
	}

	return &response, nil
}

func (s *MessageService) shouldAskAI(channelID uint, content string) bool {
	if s.channelRepo == nil || s.userGroupRepo == nil {
		return false
	}

	channel, err := s.channelRepo.FindByID(channelID)
	if err != nil {
		return false
	}

	botName := AIBotUsername
	if s.aiConfigRepo != nil {
		if groupConfig, err := s.aiConfigRepo.FindByGroupID(channel.GroupID); err == nil {
			botName = normalizeAIBotName(groupConfig.BotName)
		}
	}
	if !mentionsAI(content, botName) {
		return false
	}

	bot, err := s.userRepo.FindByEmail(AIBotEmail)
	if err != nil {
		return false
	}

	return s.userGroupRepo.Exists(bot.ID, channel.GroupID)
}

func isSummarizeRequest(content string) bool {
	lower := strings.ToLower(strings.TrimSpace(content))
	return strings.Contains(lower, "总结聊天记录") ||
		strings.Contains(lower, "summarize messages")
}

func extractSummarizeParams(content string) string {
	lower := strings.ToLower(strings.TrimSpace(content))

	// 提取时间段
	period := "today" // 默认今天
	if strings.Contains(lower, "最近7天") || strings.Contains(lower, "7天") {
		period = "last7days"
	} else if strings.Contains(lower, "最近30天") || strings.Contains(lower, "30天") {
		period = "last30days"
	} else if strings.Contains(lower, "今天") || strings.Contains(lower, "today") {
		period = "today"
	}

	return period
}

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

func (s *MessageService) buildAIReply(channelID uint, prompt string) (*model.User, string, error) {
	if s.aiService == nil {
		return nil, "", nil
	}

	channel, err := s.channelRepo.FindByID(channelID)
	if err != nil {
		logger.Warn("AI reply channel not found: %v", err)
		return nil, "", err
	}

	bot, err := s.userRepo.FindByEmail(AIBotEmail)
	if err != nil {
		logger.Warn("AI bot user not found: %v", err)
		return nil, "", err
	}

	groupConfig := &model.GroupAIConfig{}
	if s.aiConfigRepo != nil {
		if savedConfig, err := s.aiConfigRepo.FindByGroupID(channel.GroupID); err == nil {
			groupConfig = savedConfig
		}
	}

	// 检查是否为总结请求
	if isSummarizeRequest(prompt) {
		period := extractSummarizeParams(prompt)
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

		return bot, answer, nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	answer, err := s.aiService.AskWithConfig(ctx, prompt, configFromGroupAIConfig(groupConfig))
	if err != nil && !errors.Is(err, ErrAIAPIUnavailable) {
		return bot, "", err
	}
	if strings.TrimSpace(answer) == "" {
		answer = "AI 没有返回内容。"
	}

	if errors.Is(err, ErrAIAPIUnavailable) {
		return bot, answer, err
	}

	if _, err := s.createMessageAs(bot.ID, channelID, answer); err != nil {
		return bot, "", err
	}
	return bot, answer, nil
}

func configFromGroupAIConfig(groupConfig *model.GroupAIConfig) config.AIConfig {
	if groupConfig == nil {
		return config.AIConfig{}
	}
	return config.AIConfig{
		APIURL: groupConfig.APIURL,
		APIKey: groupConfig.APIKey,
		Model:  groupConfig.AIModel,
	}
}

func mentionsAI(content string, botName string) bool {
	lower := strings.ToLower(content)
	normalizedBotName := strings.ToLower(strings.TrimSpace(botName))
	return strings.Contains(lower, "@ai") ||
		strings.Contains(content, "@AI助手") ||
		strings.Contains(lower, "/ai ") ||
		(normalizedBotName != "" && strings.Contains(lower, "@"+normalizedBotName))
}

func extractAIPrompt(content string) string {
	prompt := strings.TrimSpace(content)
	replacements := []string{"@AI助手", "@ai助手", "@AI", "@ai", "/ai"}
	for _, item := range replacements {
		prompt = strings.ReplaceAll(prompt, item, "")
	}
	prompt = strings.TrimSpace(prompt)
	if strings.HasPrefix(prompt, "@") {
		parts := strings.Fields(prompt)
		if len(parts) > 1 {
			prompt = strings.Join(parts[1:], " ")
		}
	}
	return strings.TrimSpace(prompt)
}

func (s *MessageService) GetChannelMessages(channelID uint, limit, offset int, day, startAt, endAt *time.Time, queryText string, senderID *uint) ([]model.MessageResponse, error) {
	messages, err := s.messageRepo.FindByChannelID(channelID, limit, offset, day, startAt, endAt, queryText, senderID)
	if err != nil {
		return nil, err
	}
	if len(messages) == 0 {
		return []model.MessageResponse{}, nil
	}

	senderIDs := make([]uint, 0, len(messages))
	seenSenderIDs := make(map[uint]struct{}, len(messages))
	for _, msg := range messages {
		if msg.Sender.ID == 0 {
			continue
		}
		if _, exists := seenSenderIDs[msg.Sender.ID]; exists {
			continue
		}
		seenSenderIDs[msg.Sender.ID] = struct{}{}
		senderIDs = append(senderIDs, msg.Sender.ID)
	}

	decorator := s.newChannelMessageDecorator(channelID, senderIDs)
	responses := make([]model.MessageResponse, len(messages))
	for i, msg := range messages {
		responses[i] = model.ToMessageResponse(msg)
		decorator.decorate(&responses[i])
	}

	return responses, nil
}

type channelMessageDecorator struct {
	groupID          uint
	userRoles        map[uint]string
	aiBotDisplayName string
}

func (s *MessageService) newChannelMessageDecorator(channelID uint, senderIDs []uint) channelMessageDecorator {
	decorator := channelMessageDecorator{
		userRoles:        map[uint]string{},
		aiBotDisplayName: AIBotUsername,
	}
	if s.channelRepo == nil || s.userGroupRepo == nil {
		return decorator
	}

	channel, err := s.channelRepo.FindByID(channelID)
	if err != nil {
		return decorator
	}
	decorator.groupID = channel.GroupID

	if roles, err := s.userGroupRepo.FindRolesByGroupAndUserIDs(channel.GroupID, senderIDs); err == nil {
		decorator.userRoles = roles
	}
	decorator.aiBotDisplayName = s.getAIBotDisplayName(channel.GroupID)
	return decorator
}

func (d channelMessageDecorator) decorate(response *model.MessageResponse) {
	if response == nil {
		return
	}
	if role := d.userRoles[response.Sender.ID]; role != "" {
		response.Sender.GroupRole = role
	}
	if response.Sender.GroupRole == AIBotRole {
		response.Sender.Username = d.aiBotDisplayName
	}
}

func (s *MessageService) decorateChannelMessageResponse(response *model.MessageResponse, channelID uint) {
	if response == nil || s.channelRepo == nil || s.userGroupRepo == nil {
		return
	}

	channel, err := s.channelRepo.FindByID(channelID)
	if err != nil {
		return
	}

	userGroup, err := s.userGroupRepo.FindByUserAndGroup(response.Sender.ID, channel.GroupID)
	if err == nil {
		response.Sender.GroupRole = userGroup.Role
	}

	if response.Sender.GroupRole == AIBotRole {
		response.Sender.Username = s.getAIBotDisplayName(channel.GroupID)
	}
}

func (s *MessageService) getAIBotDisplayName(groupID uint) string {
	if s.aiConfigRepo == nil {
		return AIBotUsername
	}
	config, err := s.aiConfigRepo.FindByGroupID(groupID)
	if err != nil {
		return AIBotUsername
	}
	return normalizeAIBotName(config.BotName)
}

func (s *MessageService) GetMessageByID(id uint) (*model.Message, error) {
	return s.messageRepo.FindByID(id)
}

func (s *MessageService) RecallMessage(channelID, messageID, userID uint) error {
	message, err := s.messageRepo.FindByID(messageID)
	if err != nil {
		return err
	}
	if message.ChannelID != channelID {
		return ErrMessageChannelScope
	}
	if message.SenderID != userID {
		return ErrMessageNotOwned
	}
	if time.Since(message.CreatedAt) > 30*time.Second {
		return ErrMessageRecallWindow
	}

	if err := s.messageRepo.Delete(message); err != nil {
		return err
	}

	events.DispatchChannelMessageDeletedToGlobalHub(channelID, messageID)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := s.publisher.PublishChannelMessageDeleted(ctx, channelID, messageID); err != nil {
		logger.Warn("Failed to publish channel message delete event: %v", err)
	}

	return nil
}
