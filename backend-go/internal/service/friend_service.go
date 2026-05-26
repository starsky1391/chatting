package service

import (
	"errors"
	"strings"

	"chat-backend/internal/model"
	"chat-backend/internal/repository"

	"gorm.io/gorm"
)

type FriendService struct {
	userRepo          *repository.UserRepository
	friendRequestRepo *repository.FriendRequestRepository
	friendshipRepo    *repository.FriendshipRepository
}

func NewFriendService(
	userRepo *repository.UserRepository,
	friendRequestRepo *repository.FriendRequestRepository,
	friendshipRepo *repository.FriendshipRepository,
) *FriendService {
	return &FriendService{
		userRepo:          userRepo,
		friendRequestRepo: friendRequestRepo,
		friendshipRepo:    friendshipRepo,
	}
}

type CreateFriendRequestInput struct {
	AddresseeID uint   `json:"addresseeId"`
	Email       string `json:"email"`
	Username    string `json:"username"`
	Message     string `json:"message"`
}

func (s *FriendService) SearchUsers(query string, currentUserID uint) ([]model.UserResponse, error) {
	query = strings.TrimSpace(query)
	if len(query) < 2 {
		return []model.UserResponse{}, nil
	}

	users, err := s.userRepo.Search(query, currentUserID, 20)
	if err != nil {
		return nil, err
	}

	responses := make([]model.UserResponse, 0, len(users))
	for _, user := range users {
		responses = append(responses, model.ToUserResponse(user))
	}
	return responses, nil
}

func (s *FriendService) CreateFriendRequest(requesterID uint, input CreateFriendRequestInput) (*model.FriendRequestResponse, error) {
	addressee, err := s.resolveAddressee(input)
	if err != nil {
		return nil, err
	}
	if addressee.ID == requesterID {
		return nil, errors.New("cannot add yourself")
	}
	if s.friendshipRepo.Exists(requesterID, addressee.ID) {
		return nil, errors.New("already friends")
	}

	existing, err := s.friendRequestRepo.FindBetween(requesterID, addressee.ID)
	if err == nil && existing.ID != 0 && existing.Status == "pending" {
		return nil, errors.New("friend request already pending")
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	req := &model.FriendRequest{
		RequesterID: requesterID,
		AddresseeID: addressee.ID,
		Status:      "pending",
		Message:     strings.TrimSpace(input.Message),
	}
	if err := s.friendRequestRepo.Create(req); err != nil {
		return nil, err
	}

	loaded, err := s.friendRequestRepo.FindByID(req.ID)
	if err != nil {
		return nil, err
	}
	response := model.ToFriendRequestResponse(*loaded)
	return &response, nil
}

func (s *FriendService) resolveAddressee(input CreateFriendRequestInput) (*model.User, error) {
	if input.AddresseeID != 0 {
		return s.userRepo.FindByID(input.AddresseeID)
	}
	if strings.TrimSpace(input.Email) != "" {
		return s.userRepo.FindByEmail(strings.TrimSpace(input.Email))
	}
	if strings.TrimSpace(input.Username) != "" {
		return s.userRepo.FindByUsername(strings.TrimSpace(input.Username))
	}
	return nil, errors.New("addressee is required")
}

func (s *FriendService) ListIncomingRequests(userID uint) ([]model.FriendRequestResponse, error) {
	requests, err := s.friendRequestRepo.FindIncoming(userID)
	if err != nil {
		return nil, err
	}
	return toFriendRequestResponses(requests), nil
}

func (s *FriendService) ListOutgoingRequests(userID uint) ([]model.FriendRequestResponse, error) {
	requests, err := s.friendRequestRepo.FindOutgoing(userID)
	if err != nil {
		return nil, err
	}
	return toFriendRequestResponses(requests), nil
}

func (s *FriendService) AcceptRequest(userID, requestID uint) (*model.FriendRequestResponse, error) {
	req, err := s.friendRequestRepo.FindByID(requestID)
	if err != nil {
		return nil, err
	}
	if req.AddresseeID != userID {
		return nil, errors.New("not allowed")
	}
	if req.Status != "pending" {
		return nil, errors.New("request is not pending")
	}

	req.Status = "accepted"
	if err := s.friendRequestRepo.Update(req); err != nil {
		return nil, err
	}
	if err := s.friendshipRepo.CreatePair(req.RequesterID, req.AddresseeID); err != nil {
		return nil, err
	}

	loaded, err := s.friendRequestRepo.FindByID(requestID)
	if err != nil {
		return nil, err
	}
	response := model.ToFriendRequestResponse(*loaded)
	return &response, nil
}

func (s *FriendService) RejectRequest(userID, requestID uint) (*model.FriendRequestResponse, error) {
	req, err := s.friendRequestRepo.FindByID(requestID)
	if err != nil {
		return nil, err
	}
	if req.AddresseeID != userID {
		return nil, errors.New("not allowed")
	}
	if req.Status != "pending" {
		return nil, errors.New("request is not pending")
	}

	req.Status = "rejected"
	if err := s.friendRequestRepo.Update(req); err != nil {
		return nil, err
	}

	loaded, err := s.friendRequestRepo.FindByID(requestID)
	if err != nil {
		return nil, err
	}
	response := model.ToFriendRequestResponse(*loaded)
	return &response, nil
}

func (s *FriendService) ListFriends(userID uint) ([]model.FriendshipResponse, error) {
	friendships, err := s.friendshipRepo.FindByUserID(userID)
	if err != nil {
		return nil, err
	}

	responses := make([]model.FriendshipResponse, 0, len(friendships))
	for _, friendship := range friendships {
		responses = append(responses, model.ToFriendshipResponse(friendship))
	}
	return responses, nil
}

func (s *FriendService) RemoveFriend(userID, friendID uint) error {
	return s.friendshipRepo.DeletePair(userID, friendID)
}

func toFriendRequestResponses(requests []model.FriendRequest) []model.FriendRequestResponse {
	responses := make([]model.FriendRequestResponse, 0, len(requests))
	for _, req := range requests {
		responses = append(responses, model.ToFriendRequestResponse(req))
	}
	return responses
}
