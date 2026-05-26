package repository

import (
	"chat-backend/internal/model"

	"gorm.io/gorm"
)

type UserRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) Create(user *model.User) error {
	return r.db.Create(user).Error
}

func (r *UserRepository) FindByID(id uint) (*model.User, error) {
	var user model.User
	err := r.db.First(&user, id).Error
	return &user, err
}

func (r *UserRepository) FindByEmail(email string) (*model.User, error) {
	var user model.User
	err := r.db.Where("email = ?", email).First(&user).Error
	return &user, err
}

func (r *UserRepository) FindByUsername(username string) (*model.User, error) {
	var user model.User
	err := r.db.Where("username = ?", username).First(&user).Error
	return &user, err
}

func (r *UserRepository) Update(user *model.User) error {
	return r.db.Save(user).Error
}

func (r *UserRepository) UpdateProfile(id uint, updates map[string]interface{}) error {
	return r.db.Model(&model.User{}).Where("id = ?", id).Updates(updates).Error
}

func (r *UserRepository) Delete(id uint) error {
	return r.db.Delete(&model.User{}, id).Error
}

func (r *UserRepository) FindOnlineUsers() ([]model.User, error) {
	var users []model.User
	err := r.db.Where("is_online = ?", true).Find(&users).Error
	return users, err
}

func (r *UserRepository) Search(query string, currentUserID uint, limit int) ([]model.User, error) {
	var users []model.User
	pattern := "%" + query + "%"
	err := r.db.Where("id <> ? AND (username ILIKE ? OR email ILIKE ?)", currentUserID, pattern, pattern).
		Limit(limit).
		Find(&users).Error
	return users, err
}

type ChannelGroupRepository struct {
	db *gorm.DB
}

func NewChannelGroupRepository(db *gorm.DB) *ChannelGroupRepository {
	return &ChannelGroupRepository{db: db}
}

func (r *ChannelGroupRepository) Create(group *model.ChannelGroup) error {
	return r.db.Create(group).Error
}

func (r *ChannelGroupRepository) InviteCodeExists(inviteCode string) bool {
	var count int64
	r.db.Model(&model.ChannelGroup{}).Where("invite_code = ?", inviteCode).Count(&count)
	return count > 0
}

func (r *ChannelGroupRepository) FindByID(id uint) (*model.ChannelGroup, error) {
	var group model.ChannelGroup
	err := r.db.Preload("Channels").Preload("Owner").First(&group, id).Error
	return &group, err
}

func (r *ChannelGroupRepository) FindAll() ([]model.ChannelGroup, error) {
	var groups []model.ChannelGroup
	err := r.db.Preload("Channels").Preload("Owner").Find(&groups).Error
	return groups, err
}

func (r *ChannelGroupRepository) FindByUserID(userID uint) ([]model.ChannelGroup, error) {
	var groups []model.ChannelGroup
	err := r.db.Joins("JOIN user_groups ON user_groups.group_id = channel_groups.id").
		Where("user_groups.user_id = ?", userID).
		Preload("Channels").
		Find(&groups).Error
	return groups, err
}

func (r *ChannelGroupRepository) FindByInviteCode(inviteCode string) (*model.ChannelGroup, error) {
	var group model.ChannelGroup
	err := r.db.Where("invite_code = ?", inviteCode).First(&group).Error
	return &group, err
}

// FindByInviteCodeAndOwner finds a group by owner_id + invite_code (composite unique)
func (r *ChannelGroupRepository) FindByInviteCodeAndOwner(ownerID uint, inviteCode string) (*model.ChannelGroup, error) {
	var group model.ChannelGroup
	err := r.db.Where("owner_id = ? AND invite_code = ?", ownerID, inviteCode).First(&group).Error
	return &group, err
}

func (r *ChannelGroupRepository) Update(group *model.ChannelGroup) error {
	return r.db.Save(group).Error
}

func (r *ChannelGroupRepository) Delete(id uint) error {
	return r.db.Unscoped().Delete(&model.ChannelGroup{}, id).Error
}

// DB returns the underlying gorm.DB instance for transactions
func (r *ChannelGroupRepository) DB() *gorm.DB {
	return r.db
}

type ChannelRepository struct {
	db *gorm.DB
}

func NewChannelRepository(db *gorm.DB) *ChannelRepository {
	return &ChannelRepository{db: db}
}

func (r *ChannelRepository) Create(channel *model.Channel) error {
	return r.db.Create(channel).Error
}

func (r *ChannelRepository) FindByID(id uint) (*model.Channel, error) {
	var channel model.Channel
	err := r.db.First(&channel, id).Error
	return &channel, err
}

func (r *ChannelRepository) FindAll() ([]model.Channel, error) {
	var channels []model.Channel
	err := r.db.Order("position asc").Find(&channels).Error
	return channels, err
}

func (r *ChannelRepository) FindByGroupID(groupID uint) ([]model.Channel, error) {
	var channels []model.Channel
	err := r.db.Where("group_id = ?", groupID).Order("position asc").Find(&channels).Error
	return channels, err
}

func (r *ChannelRepository) FindByGroupIDAndType(groupID uint, channelType string) ([]model.Channel, error) {
	var channels []model.Channel
	err := r.db.Where("group_id = ? AND type = ?", groupID, channelType).Order("position asc").Find(&channels).Error
	return channels, err
}

func (r *ChannelRepository) NameExists(groupID uint, name string, excludeID uint) bool {
	var count int64
	query := r.db.Model(&model.Channel{}).Where("group_id = ? AND lower(name) = lower(?)", groupID, name)
	if excludeID != 0 {
		query = query.Where("id <> ?", excludeID)
	}
	query.Count(&count)
	return count > 0
}

func (r *ChannelRepository) Update(channel *model.Channel) error {
	return r.db.Save(channel).Error
}

func (r *ChannelRepository) Delete(id uint) error {
	return r.db.Unscoped().Delete(&model.Channel{}, id).Error
}

// DeleteByGroupID deletes all channels belonging to a group (hard delete)
func (r *ChannelRepository) DeleteByGroupID(groupID uint) error {
	return r.db.Unscoped().Where("group_id = ?", groupID).Delete(&model.Channel{}).Error
}

type MessageRepository struct {
	db *gorm.DB
}

func NewMessageRepository(db *gorm.DB) *MessageRepository {
	return &MessageRepository{db: db}
}

func (r *MessageRepository) Create(message *model.Message) error {
	return r.db.Create(message).Error
}

func (r *MessageRepository) FindByChannelID(channelID uint, limit, offset int) ([]model.Message, error) {
	var messages []model.Message
	err := r.db.Preload("Sender").
		Where("channel_id = ?", channelID).
		Order("created_at desc").
		Limit(limit).
		Offset(offset).
		Find(&messages).Error
	return messages, err
}

func (r *MessageRepository) FindByID(id uint) (*model.Message, error) {
	var message model.Message
	err := r.db.Preload("Sender").First(&message, id).Error
	return &message, err
}

type UserChannelRepository struct {
	db *gorm.DB
}

func NewUserChannelRepository(db *gorm.DB) *UserChannelRepository {
	return &UserChannelRepository{db: db}
}

func (r *UserChannelRepository) Create(userChannel *model.UserChannel) error {
	return r.db.Create(userChannel).Error
}

func (r *UserChannelRepository) FindByUserID(userID uint) ([]model.UserChannel, error) {
	var userChannels []model.UserChannel
	err := r.db.Preload("Channel").Where("user_id = ?", userID).Find(&userChannels).Error
	return userChannels, err
}

func (r *UserChannelRepository) FindByChannelID(channelID uint) ([]model.UserChannel, error) {
	var userChannels []model.UserChannel
	err := r.db.Preload("User").Where("channel_id = ?", channelID).Find(&userChannels).Error
	return userChannels, err
}

func (r *UserChannelRepository) Delete(userID, channelID uint) error {
	return r.db.Where("user_id = ? AND channel_id = ?", userID, channelID).Delete(&model.UserChannel{}).Error
}

func (r *UserChannelRepository) Exists(userID, channelID uint) bool {
	var count int64
	r.db.Model(&model.UserChannel{}).Where("user_id = ? AND channel_id = ?", userID, channelID).Count(&count)
	return count > 0
}

type UserGroupRepository struct {
	db *gorm.DB
}

func NewUserGroupRepository(db *gorm.DB) *UserGroupRepository {
	return &UserGroupRepository{db: db}
}

func (r *UserGroupRepository) Create(userGroup *model.UserGroup) error {
	return r.db.Create(userGroup).Error
}

func (r *UserGroupRepository) FindByUserID(userID uint) ([]model.UserGroup, error) {
	var userGroups []model.UserGroup
	err := r.db.Preload("Group").Where("user_id = ?", userID).Find(&userGroups).Error
	return userGroups, err
}

func (r *UserGroupRepository) FindByGroupID(groupID uint) ([]model.UserGroup, error) {
	var userGroups []model.UserGroup
	err := r.db.Preload("User").Where("group_id = ?", groupID).Find(&userGroups).Error
	return userGroups, err
}

func (r *UserGroupRepository) Delete(userID, groupID uint) error {
	return r.db.Where("user_id = ? AND group_id = ?", userID, groupID).Delete(&model.UserGroup{}).Error
}

// DeleteByGroupID deletes all user_group records for a group
func (r *UserGroupRepository) DeleteByGroupID(groupID uint) error {
	return r.db.Where("group_id = ?", groupID).Delete(&model.UserGroup{}).Error
}

func (r *UserGroupRepository) Exists(userID, groupID uint) bool {
	var count int64
	r.db.Model(&model.UserGroup{}).Where("user_id = ? AND group_id = ?", userID, groupID).Count(&count)
	return count > 0
}

func (r *UserGroupRepository) GetGroupMembers(groupID uint) ([]model.User, error) {
	var users []model.User
	err := r.db.Joins("JOIN user_groups ON user_groups.user_id = users.id").
		Where("user_groups.group_id = ?", groupID).
		Find(&users).Error
	return users, err
}

func (r *UserGroupRepository) GetUserRole(userID, groupID uint) string {
	var userGroup model.UserGroup
	err := r.db.Where("user_id = ? AND group_id = ?", userID, groupID).First(&userGroup).Error
	if err != nil {
		return ""
	}
	return userGroup.Role
}

type WechatBindingRepository struct {
	db *gorm.DB
}

func NewWechatBindingRepository(db *gorm.DB) *WechatBindingRepository {
	return &WechatBindingRepository{db: db}
}

func (r *WechatBindingRepository) Create(binding *model.WechatBinding) error {
	return r.db.Create(binding).Error
}

func (r *WechatBindingRepository) FindByOpenID(openID string) (*model.WechatBinding, error) {
	var binding model.WechatBinding
	err := r.db.Preload("User").Where("openid = ?", openID).First(&binding).Error
	return &binding, err
}

func (r *WechatBindingRepository) FindByUserID(userID uint) (*model.WechatBinding, error) {
	var binding model.WechatBinding
	err := r.db.Where("user_id = ?", userID).First(&binding).Error
	return &binding, err
}

func (r *WechatBindingRepository) Delete(userID uint) error {
	return r.db.Where("user_id = ?", userID).Delete(&model.WechatBinding{}).Error
}

type FriendRequestRepository struct {
	db *gorm.DB
}

func NewFriendRequestRepository(db *gorm.DB) *FriendRequestRepository {
	return &FriendRequestRepository{db: db}
}

func (r *FriendRequestRepository) Create(req *model.FriendRequest) error {
	return r.db.Create(req).Error
}

func (r *FriendRequestRepository) FindByID(id uint) (*model.FriendRequest, error) {
	var req model.FriendRequest
	err := r.db.Preload("Requester").Preload("Addressee").First(&req, id).Error
	return &req, err
}

func (r *FriendRequestRepository) FindBetween(userA, userB uint) (*model.FriendRequest, error) {
	var req model.FriendRequest
	err := r.db.Where(
		"(requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)",
		userA, userB, userB, userA,
	).Order("created_at desc").First(&req).Error
	return &req, err
}

func (r *FriendRequestRepository) FindIncoming(userID uint) ([]model.FriendRequest, error) {
	var requests []model.FriendRequest
	err := r.db.Preload("Requester").Preload("Addressee").
		Where("addressee_id = ? AND status = ?", userID, "pending").
		Order("created_at desc").
		Find(&requests).Error
	return requests, err
}

func (r *FriendRequestRepository) FindOutgoing(userID uint) ([]model.FriendRequest, error) {
	var requests []model.FriendRequest
	err := r.db.Preload("Requester").Preload("Addressee").
		Where("requester_id = ? AND status = ?", userID, "pending").
		Order("created_at desc").
		Find(&requests).Error
	return requests, err
}

func (r *FriendRequestRepository) Update(req *model.FriendRequest) error {
	return r.db.Save(req).Error
}

type FriendshipRepository struct {
	db *gorm.DB
}

func NewFriendshipRepository(db *gorm.DB) *FriendshipRepository {
	return &FriendshipRepository{db: db}
}

func (r *FriendshipRepository) Exists(userID, friendID uint) bool {
	var count int64
	r.db.Model(&model.Friendship{}).Where("user_id = ? AND friend_id = ?", userID, friendID).Count(&count)
	return count > 0
}

func (r *FriendshipRepository) CreatePair(userA, userB uint) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		pair := []model.Friendship{
			{UserID: userA, FriendID: userB},
			{UserID: userB, FriendID: userA},
		}
		for _, friendship := range pair {
			var count int64
			tx.Model(&model.Friendship{}).
				Where("user_id = ? AND friend_id = ?", friendship.UserID, friendship.FriendID).
				Count(&count)
			if count == 0 {
				if err := tx.Create(&friendship).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})
}

func (r *FriendshipRepository) FindByUserID(userID uint) ([]model.Friendship, error) {
	var friendships []model.Friendship
	err := r.db.Preload("Friend").
		Where("user_id = ?", userID).
		Order("created_at desc").
		Find(&friendships).Error
	return friendships, err
}

func (r *FriendshipRepository) DeletePair(userA, userB uint) error {
	return r.db.Where(
		"(user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)",
		userA, userB, userB, userA,
	).Delete(&model.Friendship{}).Error
}

type DirectConversationRepository struct {
	db *gorm.DB
}

func NewDirectConversationRepository(db *gorm.DB) *DirectConversationRepository {
	return &DirectConversationRepository{db: db}
}

func (r *DirectConversationRepository) FindByPairKey(pairKey string) (*model.DirectConversation, error) {
	var conversation model.DirectConversation
	err := r.db.Preload("Members").Where("pair_key = ?", pairKey).First(&conversation).Error
	return &conversation, err
}

func (r *DirectConversationRepository) Create(conversation *model.DirectConversation) error {
	return r.db.Create(conversation).Error
}

func (r *DirectConversationRepository) FindByUserID(userID uint) ([]model.DirectConversation, error) {
	var conversations []model.DirectConversation
	err := r.db.Preload("Members").
		Joins("JOIN direct_conversation_members dcm ON dcm.direct_conversation_id = direct_conversations.id").
		Where("dcm.user_id = ?", userID).
		Order("COALESCE(last_message_at, direct_conversations.created_at) desc").
		Find(&conversations).Error
	return conversations, err
}

func (r *DirectConversationRepository) FindByIDForUser(conversationID, userID uint) (*model.DirectConversation, error) {
	var conversation model.DirectConversation
	err := r.db.Preload("Members").
		Joins("JOIN direct_conversation_members dcm ON dcm.direct_conversation_id = direct_conversations.id").
		Where("direct_conversations.id = ? AND dcm.user_id = ?", conversationID, userID).
		First(&conversation).Error
	return &conversation, err
}

func (r *DirectConversationRepository) Touch(conversationID uint) error {
	return r.db.Model(&model.DirectConversation{}).
		Where("id = ?", conversationID).
		Update("last_message_at", gorm.Expr("NOW()")).Error
}

type DirectMessageRepository struct {
	db *gorm.DB
}

func NewDirectMessageRepository(db *gorm.DB) *DirectMessageRepository {
	return &DirectMessageRepository{db: db}
}

func (r *DirectMessageRepository) Create(message *model.DirectMessage) error {
	return r.db.Create(message).Error
}

func (r *DirectMessageRepository) FindByConversationID(conversationID uint, limit, offset int) ([]model.DirectMessage, error) {
	var messages []model.DirectMessage
	err := r.db.Preload("Sender").
		Where("conversation_id = ?", conversationID).
		Order("created_at desc").
		Limit(limit).
		Offset(offset).
		Find(&messages).Error
	return messages, err
}
