package service

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"time"

	"chat-backend/internal/events"
	"chat-backend/internal/model"
	"chat-backend/internal/repository"
	"chat-backend/pkg/logger"
)

type DirectMessageService struct {
	userRepo         *repository.UserRepository
	friendshipRepo   *repository.FriendshipRepository
	conversationRepo *repository.DirectConversationRepository
	messageRepo      *repository.DirectMessageRepository
	publisher        events.Publisher
}

func NewDirectMessageService(
	userRepo *repository.UserRepository,
	friendshipRepo *repository.FriendshipRepository,
	conversationRepo *repository.DirectConversationRepository,
	messageRepo *repository.DirectMessageRepository,
	publisher events.Publisher,
) *DirectMessageService {
	if publisher == nil {
		publisher = events.NoopPublisher{}
	}
	return &DirectMessageService{
		userRepo:         userRepo,
		friendshipRepo:   friendshipRepo,
		conversationRepo: conversationRepo,
		messageRepo:      messageRepo,
		publisher:        publisher,
	}
}

type CreateDirectConversationInput struct {
	UserID uint `json:"userId" binding:"required"`
}

type CreateDirectMessageInput struct {
	Content string `json:"content" binding:"required"`
}

func (s *DirectMessageService) ListConversations(userID uint) ([]model.DirectConversationResponse, error) {
	conversations, err := s.conversationRepo.FindByUserID(userID)
	if err != nil {
		return nil, err
	}

	responses := make([]model.DirectConversationResponse, 0, len(conversations))
	for _, conversation := range conversations {
		responses = append(responses, model.ToDirectConversationResponse(conversation))
	}
	return responses, nil
}

func (s *DirectMessageService) GetOrCreateConversation(currentUserID, otherUserID uint) (*model.DirectConversationResponse, error) {
	if currentUserID == otherUserID {
		return nil, errors.New("cannot message yourself")
	}

	otherUser, err := s.userRepo.FindByID(otherUserID)
	if err != nil {
		return nil, err
	}
	currentUser, err := s.userRepo.FindByID(currentUserID)
	if err != nil {
		return nil, err
	}

	pairKey := directPairKey(currentUserID, otherUserID)
	conversation, err := s.conversationRepo.FindByPairKey(pairKey)
	if err == nil && conversation.ID != 0 {
		response := model.ToDirectConversationResponse(*conversation)
		return &response, nil
	}

	conversation = &model.DirectConversation{
		PairKey: pairKey,
		Members: []model.User{
			*currentUser,
			*otherUser,
		},
	}
	if err := s.conversationRepo.Create(conversation); err != nil {
		return nil, err
	}

	loaded, err := s.conversationRepo.FindByPairKey(pairKey)
	if err != nil {
		return nil, err
	}
	response := model.ToDirectConversationResponse(*loaded)
	return &response, nil
}

func (s *DirectMessageService) GetConversation(userID, conversationID uint) (*model.DirectConversationResponse, error) {
	conversation, err := s.conversationRepo.FindByIDForUser(conversationID, userID)
	if err != nil {
		return nil, err
	}
	response := model.ToDirectConversationResponse(*conversation)
	return &response, nil
}

func (s *DirectMessageService) ListMessages(userID, conversationID uint, limit, offset int) ([]model.DirectMessageResponse, error) {
	if _, err := s.conversationRepo.FindByIDForUser(conversationID, userID); err != nil {
		return nil, err
	}

	messages, err := s.messageRepo.FindByConversationID(conversationID, limit, offset)
	if err != nil {
		return nil, err
	}

	responses := make([]model.DirectMessageResponse, 0, len(messages))
	for _, message := range messages {
		responses = append(responses, model.ToDirectMessageResponse(message))
	}
	return responses, nil
}

func (s *DirectMessageService) CreateMessage(userID, conversationID uint, input CreateDirectMessageInput) (*model.DirectMessageResponse, error) {
	conversation, err := s.conversationRepo.FindByIDForUser(conversationID, userID)
	if err != nil {
		return nil, err
	}

	message := &model.DirectMessage{
		ConversationID: conversationID,
		SenderID:       userID,
		Content:        input.Content,
	}
	if err := s.messageRepo.Create(message); err != nil {
		return nil, err
	}
	if err := s.conversationRepo.Touch(conversationID); err != nil {
		return nil, err
	}

	sender, err := s.userRepo.FindByID(userID)
	if err != nil {
		return nil, err
	}
	message.Sender = *sender
	response := model.ToDirectMessageResponse(*message)
	memberIDs := make([]uint, 0, len(conversation.Members))
	for _, member := range conversation.Members {
		memberIDs = append(memberIDs, member.ID)
	}
	events.DispatchDirectMessageCreatedToGlobalHub(conversationID, memberIDs, response)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := s.publisher.PublishDirectMessageCreated(ctx, conversationID, memberIDs, response); err != nil {
		logger.Warn("Failed to publish direct message event: %v", err)
	}

	return &response, nil
}

func directPairKey(userA, userB uint) string {
	ids := []uint{userA, userB}
	sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })
	return fmt.Sprintf("%d:%d", ids[0], ids[1])
}
