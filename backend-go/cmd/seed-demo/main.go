package main

import (
	"encoding/base64"
	"fmt"
	"log"
	"math/rand"
	"os"
	"path/filepath"
	"time"

	"chat-backend/internal/config"
	"chat-backend/internal/model"
	"chat-backend/pkg/utils"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

const (
	demoOwnerUsername = "foya"
	demoOwnerEmail    = "foya@example.com"
	demoPassword      = "123456"
	demoGroupName     = "test"
	demoMemberCount   = 100
	demoMessageCount  = 128
)

var demoNames = []string{
	"akira", "blake", "cora", "dawn", "ember", "finn", "gale", "haze", "iris", "juno",
	"kai", "lena", "milo", "nova", "orin", "piper", "quinn", "rhea", "sora", "tess",
	"uma", "vance", "wren", "xavi", "yuki", "zane", "aria", "bryn", "cleo", "dax",
	"eden", "faye", "gray", "hope", "ivan", "jade", "kira", "luca", "mira", "nico",
}

func main() {
	rand.Seed(20260526)

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	db, err := model.InitDB(cfg.Database)
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}
	if err := model.AutoMigrate(db); err != nil {
		log.Fatalf("failed to migrate database: %v", err)
	}

	summary, err := seedDemo(db)
	if err != nil {
		log.Fatalf("failed to seed demo data: %v", err)
	}

	log.Printf("Demo data ready")
	log.Printf("Owner: %s / %s / %s", demoOwnerUsername, demoOwnerEmail, demoPassword)
	log.Printf("Group: %s (id=%d)", demoGroupName, summary.GroupID)
	log.Printf("Members: %d", summary.MemberCount)
	log.Printf("Channel messages: %d", summary.ChannelMessages)
	log.Printf("Direct message conversations: %d", summary.DirectConversations)
}

type demoSummary struct {
	GroupID             uint
	MemberCount         int
	ChannelMessages     int
	DirectConversations int
}

func seedDemo(db *gorm.DB) (*demoSummary, error) {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(demoPassword), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	var summary demoSummary
	err = db.Transaction(func(tx *gorm.DB) error {
		owner, err := upsertDemoUser(tx, demoOwnerEmail, demoOwnerUsername, string(hashedPassword), "F")
		if err != nil {
			return err
		}

		group, err := upsertDemoGroup(tx, owner.ID)
		if err != nil {
			return err
		}
		summary.GroupID = group.ID

		if err := ensureDefaultRoles(tx, group.ID); err != nil {
			return err
		}

		textChannel, voiceChannel, err := ensureDemoChannels(tx, group.ID, owner.ID)
		if err != nil {
			return err
		}
		_ = voiceChannel

		members := make([]model.User, 0, demoMemberCount)
		members = append(members, *owner)
		if err := ensureMembership(tx, owner.ID, group.ID, "owner"); err != nil {
			return err
		}

		for i := 1; i < demoMemberCount; i++ {
			username := demoUsername(i)
			email := fmt.Sprintf("demo%03d@test.com", i)
			avatar := username[:1]
			user, err := upsertDemoUser(tx, email, username, string(hashedPassword), avatar)
			if err != nil {
				return err
			}
			role := "guest"
			if i%17 == 0 {
				role = "admin"
			}
			if err := ensureMembership(tx, user.ID, group.ID, role); err != nil {
				return err
			}
			members = append(members, *user)
		}
		summary.MemberCount = len(members)

		imagePaths, err := ensureDemoImages()
		if err != nil {
			return err
		}

		if err := rebuildChannelMessages(tx, textChannel.ID, members, imagePaths); err != nil {
			return err
		}
		summary.ChannelMessages = demoMessageCount

		conversationCount, err := rebuildDirectMessages(tx, *owner, members[1:6])
		if err != nil {
			return err
		}
		summary.DirectConversations = conversationCount

		return nil
	})
	if err != nil {
		return nil, err
	}

	return &summary, nil
}

func upsertDemoUser(tx *gorm.DB, email, username, hashedPassword, avatar string) (*model.User, error) {
	var user model.User
	err := tx.Where("email = ?", email).First(&user).Error
	if err == nil {
		updates := map[string]interface{}{
			"username": username,
			"password": hashedPassword,
			"avatar":   avatar,
			"role":     "member",
		}
		if email == demoOwnerEmail {
			updates["username"] = demoOwnerUsername
		}
		if err := tx.Model(&user).Updates(updates).Error; err != nil {
			return nil, err
		}
		if err := tx.Where("email = ?", email).First(&user).Error; err != nil {
			return nil, err
		}
		return &user, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, err
	}

	user = model.User{
		Username: username,
		Email:    email,
		Password: hashedPassword,
		Avatar:   avatar,
		Role:     "member",
		IsOnline: false,
	}
	if err := tx.Create(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func upsertDemoGroup(tx *gorm.DB, ownerID uint) (*model.ChannelGroup, error) {
	var group model.ChannelGroup
	err := tx.Where("name = ? AND owner_id = ?", demoGroupName, ownerID).First(&group).Error
	if err == nil {
		updates := map[string]interface{}{
			"description": "Demo group with 100 members, rich channel history, images and direct messages.",
			"icon":        "T",
		}
		if group.InviteCode == "" {
			updates["invite_code"] = generateUniqueInviteCode(tx)
		}
		if err := tx.Model(&group).Updates(updates).Error; err != nil {
			return nil, err
		}
		if err := tx.Where("name = ? AND owner_id = ?", demoGroupName, ownerID).First(&group).Error; err != nil {
			return nil, err
		}
		return &group, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, err
	}

	group = model.ChannelGroup{
		Name:        demoGroupName,
		Description: "Demo group with 100 members, rich channel history, images and direct messages.",
		Icon:        "T",
		OwnerID:     ownerID,
		InviteCode:  generateUniqueInviteCode(tx),
	}
	if err := tx.Create(&group).Error; err != nil {
		return nil, err
	}
	return &group, nil
}

func ensureDefaultRoles(tx *gorm.DB, groupID uint) error {
	roles := []model.GroupRole{
		{
			GroupID:     groupID,
			Name:        "admin",
			Description: "Can manage members and channels",
			Color:       "#8b5cf6",
			Position:    1,
			IsSystem:    true,
		},
		{
			GroupID:     groupID,
			Name:        "guest",
			Description: "Default role for demo members",
			Color:       "#14b8a6",
			Position:    2,
			IsDefault:   true,
			IsSystem:    true,
		},
	}

	for _, role := range roles {
		var existing model.GroupRole
		err := tx.Where("group_id = ? AND name = ?", groupID, role.Name).First(&existing).Error
		if err == nil {
			if err := tx.Model(&existing).Updates(map[string]interface{}{
				"description": role.Description,
				"color":       role.Color,
				"position":    role.Position,
				"is_default":  role.IsDefault,
				"is_system":   role.IsSystem,
			}).Error; err != nil {
				return err
			}
			continue
		}
		if err != gorm.ErrRecordNotFound {
			return err
		}
		if err := tx.Create(&role).Error; err != nil {
			return err
		}
	}
	return nil
}

func ensureDemoChannels(tx *gorm.DB, groupID, ownerID uint) (*model.Channel, *model.Channel, error) {
	text, err := ensureChannel(tx, model.Channel{
		Name:        "general",
		Type:        "text",
		Description: "Demo channel with more than 100 messages and images.",
		GroupID:     groupID,
		Position:    0,
		CreatedBy:   ownerID,
	})
	if err != nil {
		return nil, nil, err
	}

	voice, err := ensureChannel(tx, model.Channel{
		Name:        "voice-demo",
		Type:        "voice",
		Description: "Demo voice channel",
		GroupID:     groupID,
		Position:    1,
		CreatedBy:   ownerID,
		MaxMembers:  100,
	})
	if err != nil {
		return nil, nil, err
	}

	return text, voice, nil
}

func ensureChannel(tx *gorm.DB, channel model.Channel) (*model.Channel, error) {
	var existing model.Channel
	err := tx.Where("group_id = ? AND name = ?", channel.GroupID, channel.Name).First(&existing).Error
	if err == nil {
		if err := tx.Model(&existing).Updates(map[string]interface{}{
			"type":        channel.Type,
			"description": channel.Description,
			"position":    channel.Position,
			"created_by":  channel.CreatedBy,
			"max_members": channel.MaxMembers,
		}).Error; err != nil {
			return nil, err
		}
		if err := tx.First(&existing, existing.ID).Error; err != nil {
			return nil, err
		}
		return &existing, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, err
	}
	if err := tx.Create(&channel).Error; err != nil {
		return nil, err
	}
	return &channel, nil
}

func ensureMembership(tx *gorm.DB, userID, groupID uint, role string) error {
	var userGroup model.UserGroup
	err := tx.Where("user_id = ? AND group_id = ?", userID, groupID).First(&userGroup).Error
	if err == nil {
		return tx.Model(&userGroup).Update("role", role).Error
	}
	if err != gorm.ErrRecordNotFound {
		return err
	}
	return tx.Create(&model.UserGroup{
		UserID:  userID,
		GroupID: groupID,
		Role:    role,
	}).Error
}

func rebuildChannelMessages(tx *gorm.DB, channelID uint, members []model.User, imagePaths []string) error {
	if err := tx.Unscoped().Where("channel_id = ?", channelID).Delete(&model.Message{}).Error; err != nil {
		return err
	}

	start := time.Now().Add(-6 * time.Hour)
	messages := make([]model.Message, 0, demoMessageCount)
	for i := 1; i <= demoMessageCount; i++ {
		sender := members[(i-1)%len(members)]
		content := fmt.Sprintf("Demo message %03d from %s: this test group is ready for a presentation.", i, sender.Username)
		if i%13 == 0 {
			content = imagePaths[(i/13-1)%len(imagePaths)]
		}
		messages = append(messages, model.Message{
			Content:   content,
			SenderID:  sender.ID,
			ChannelID: channelID,
			Model: gorm.Model{
				CreatedAt: start.Add(time.Duration(i) * 2 * time.Minute),
				UpdatedAt: start.Add(time.Duration(i) * 2 * time.Minute),
			},
		})
	}

	return tx.CreateInBatches(messages, 50).Error
}

func rebuildDirectMessages(tx *gorm.DB, owner model.User, peers []model.User) (int, error) {
	count := 0
	for i, peer := range peers {
		pairKey := directPairKey(owner.ID, peer.ID)
		conversation, err := ensureConversation(tx, pairKey, owner, peer)
		if err != nil {
			return count, err
		}
		if err := tx.Unscoped().Where("conversation_id = ?", conversation.ID).Delete(&model.DirectMessage{}).Error; err != nil {
			return count, err
		}

		base := time.Now().Add(time.Duration(-i-1) * time.Hour)
		messages := []model.DirectMessage{
			{ConversationID: conversation.ID, SenderID: peer.ID, Content: fmt.Sprintf("Hi %s, I joined the demo group.", owner.Username), Model: gorm.Model{CreatedAt: base, UpdatedAt: base}},
			{ConversationID: conversation.ID, SenderID: owner.ID, Content: "Welcome. This private message thread is part of the demo data.", Model: gorm.Model{CreatedAt: base.Add(2 * time.Minute), UpdatedAt: base.Add(2 * time.Minute)}},
			{ConversationID: conversation.ID, SenderID: peer.ID, Content: "Looks good. The channel history also includes image messages.", Model: gorm.Model{CreatedAt: base.Add(4 * time.Minute), UpdatedAt: base.Add(4 * time.Minute)}},
		}
		if err := tx.Create(&messages).Error; err != nil {
			return count, err
		}
		if err := tx.Model(conversation).Update("last_message_at", messages[len(messages)-1].CreatedAt).Error; err != nil {
			return count, err
		}
		count++
	}
	return count, nil
}

func ensureConversation(tx *gorm.DB, pairKey string, userA, userB model.User) (*model.DirectConversation, error) {
	var conversation model.DirectConversation
	err := tx.Where("pair_key = ?", pairKey).First(&conversation).Error
	if err == nil {
		if err := ensureConversationMember(tx, conversation.ID, userA.ID); err != nil {
			return nil, err
		}
		if err := ensureConversationMember(tx, conversation.ID, userB.ID); err != nil {
			return nil, err
		}
		return &conversation, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, err
	}

	conversation = model.DirectConversation{
		PairKey: pairKey,
		Members: []model.User{
			userA,
			userB,
		},
	}
	if err := tx.Create(&conversation).Error; err != nil {
		return nil, err
	}
	return &conversation, nil
}

func ensureConversationMember(tx *gorm.DB, conversationID, userID uint) error {
	var count int64
	if err := tx.Model(&model.DirectConversationMember{}).
		Where("direct_conversation_id = ? AND user_id = ?", conversationID, userID).
		Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	return tx.Create(&model.DirectConversationMember{
		DirectConversationID: conversationID,
		UserID:               userID,
	}).Error
}

func ensureDemoImages() ([]string, error) {
	uploadDir := filepath.Join("uploads", "images")
	if err := os.MkdirAll(uploadDir, 0o755); err != nil {
		return nil, err
	}

	images := []struct {
		fileName string
		data     string
	}{
		{"demo-seed-blue.png", "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAWUlEQVR4nO3PQQ3AIADAQMDWf1M7sJqSiNFYrJ3w2q7A3QH8xQGIAxAHIA5AHIA4AHEA4gDEAYgDEAcgDkAcgDgAcQDiAMQBiAMQByAOQByAOABxAOIAxAGIAxAHIA5AHAA4AHEA4gDEAYiDAXxEAhYvSdvVAAAAAElFTkSuQmCC"},
		{"demo-seed-green.png", "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAWklEQVR4nO3PQQ3AIADAQMB2f1M7cD0lEaOxWDvhtV2BuwP4iwMQByAOQByAOABxAOIAxAGIAxAHIA5AHIA4AHEA4gDEAYgDEAcgDkAcgDgAcQDiAMQBiAMQB4P4CQeSFRaNMQAAAABJRU5ErkJggg=="},
		{"demo-seed-purple.png", "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAWklEQVR4nO3PQQ3AIADAQMCmf1M7kE2lEaOxWDvhtV2BuwP4iwMQByAOQByAOABxAOIAxAGIAxAHIA5AHIA4AHEA4gDEAYgDEAcgDkAcgDgAcQDiAMQBiAMQB4P4CQnvFE5kWQAAAABJRU5ErkJggg=="},
	}

	paths := make([]string, 0, len(images))
	for _, image := range images {
		fullPath := filepath.Join(uploadDir, image.fileName)
		decoded, err := base64.StdEncoding.DecodeString(image.data)
		if err != nil {
			return nil, err
		}
		if err := os.WriteFile(fullPath, decoded, 0o644); err != nil {
			return nil, err
		}
		paths = append(paths, "/uploads/images/"+image.fileName)
	}
	return paths, nil
}

func demoUsername(index int) string {
	name := demoNames[(index-1)%len(demoNames)]
	return fmt.Sprintf("%s-%03d", name, index)
}

func generateUniqueInviteCode(tx *gorm.DB) string {
	code := utils.GenerateInviteCode()
	for i := 0; i < 10; i++ {
		var count int64
		if err := tx.Model(&model.ChannelGroup{}).Where("invite_code = ?", code).Count(&count).Error; err != nil {
			return code
		}
		if count == 0 {
			return code
		}
		code = utils.GenerateInviteCode()
	}
	return fmt.Sprintf("TEST%d", rand.Intn(900000)+100000)
}

func directPairKey(userA, userB uint) string {
	if userA > userB {
		userA, userB = userB, userA
	}
	return fmt.Sprintf("%d:%d", userA, userB)
}
