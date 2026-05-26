package service

import (
	"context"
	"time"

	"chat-backend/internal/events"
	"chat-backend/internal/model"
	"chat-backend/internal/repository"
	"chat-backend/pkg/logger"
)

type MessageService struct {
	messageRepo *repository.MessageRepository
	userRepo    *repository.UserRepository
	publisher   events.Publisher
}

func NewMessageService(messageRepo *repository.MessageRepository, userRepo *repository.UserRepository, publisher events.Publisher) *MessageService {
	if publisher == nil {
		publisher = events.NoopPublisher{}
	}
	return &MessageService{
		messageRepo: messageRepo,
		userRepo:    userRepo,
		publisher:   publisher,
	}
}

type CreateMessageInput struct {
	Content   string `json:"content" binding:"required"`
	SenderID  uint   `json:"senderId"`
	ChannelID uint   `json:"channelId"`
}

func (s *MessageService) CreateMessage(input CreateMessageInput) (*model.MessageResponse, error) {
	message := &model.Message{
		Content:   input.Content,
		SenderID:  input.SenderID,
		ChannelID: input.ChannelID,
	}

	if err := s.messageRepo.Create(message); err != nil {
		return nil, err
	}

	// Load sender info
	user, err := s.userRepo.FindByID(input.SenderID)
	if err != nil {
		return nil, err
	}
	message.Sender = *user

	response := model.ToMessageResponse(*message)
	events.DispatchChannelMessageCreatedToGlobalHub(input.ChannelID, response)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := s.publisher.PublishChannelMessageCreated(ctx, input.ChannelID, response); err != nil {
		logger.Warn("Failed to publish channel message event: %v", err)
	}

	return &response, nil
}

func (s *MessageService) GetChannelMessages(channelID uint, limit, offset int) ([]model.MessageResponse, error) {
	messages, err := s.messageRepo.FindByChannelID(channelID, limit, offset)
	if err != nil {
		return nil, err
	}

	responses := make([]model.MessageResponse, len(messages))
	for i, msg := range messages {
		responses[i] = model.ToMessageResponse(msg)
	}

	return responses, nil
}

func (s *MessageService) GetMessageByID(id uint) (*model.Message, error) {
	return s.messageRepo.FindByID(id)
}
