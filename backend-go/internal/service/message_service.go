package service

import (
	"chat-backend/internal/model"
	"chat-backend/internal/repository"
)

type MessageService struct {
	messageRepo *repository.MessageRepository
	userRepo    *repository.UserRepository
}

func NewMessageService(messageRepo *repository.MessageRepository, userRepo *repository.UserRepository) *MessageService {
	return &MessageService{
		messageRepo: messageRepo,
		userRepo:    userRepo,
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