package model

import (
	"fmt"
	"log"

	"chat-backend/internal/config"
	"chat-backend/pkg/utils"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func InitDB(cfg config.DatabaseConfig) (*gorm.DB, error) {
	var dsn string

	if cfg.URL != "" {
		dsn = cfg.URL
	} else {
		dsn = fmt.Sprintf(
			"host=%s port=%d user=%s password=%s dbname=%s sslmode=disable",
			cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.DBName,
		)
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect database: %w", err)
	}

	log.Println("Database connected successfully")
	return db, nil
}

func AutoMigrate(db *gorm.DB) error {
	err := db.AutoMigrate(
		&User{},
		&ChannelGroup{},
		&Channel{},
		&Message{},
		&UserChannel{},
		&UserGroup{},
		&WechatBinding{},
		&FriendRequest{},
		&Friendship{},
		&DirectConversation{},
		&DirectConversationMember{},
		&DirectMessage{},
	)
	if err != nil {
		return fmt.Errorf("failed to migrate database: %w", err)
	}

	log.Println("Database migrated successfully")
	return nil
}

func SeedAdminUser(db *gorm.DB, cfg config.AdminConfig) error {
	if cfg.Email == "" || cfg.Username == "" || cfg.Password == "" {
		return fmt.Errorf("admin email, username and password are required")
	}

	var user User
	err := db.Where("email = ?", cfg.Email).First(&user).Error
	if err == nil {
		updates := map[string]interface{}{
			"role": "admin",
		}
		if user.Username == "" {
			updates["username"] = cfg.Username
		}
		if err := db.Model(&user).Updates(updates).Error; err != nil {
			return err
		}
		log.Printf("Admin account ready: %s", cfg.Email)
		return nil
	}
	if err != nil && err != gorm.ErrRecordNotFound {
		return err
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(cfg.Password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	admin := User{
		Username: cfg.Username,
		Email:    cfg.Email,
		Password: string(hashedPassword),
		Avatar:   "A",
		Role:     "admin",
		IsOnline: false,
	}
	if err := db.Create(&admin).Error; err != nil {
		return err
	}

	log.Printf("Admin account created: %s", cfg.Email)
	return nil
}

func CreateDefaultChannels(db *gorm.DB, adminEmail string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		var owner User
		if adminEmail != "" {
			if err := tx.Where("email = ?", adminEmail).First(&owner).Error; err != nil {
				return fmt.Errorf("failed to find default channel owner: %w", err)
			}
		} else {
			if err := tx.Where("role = ?", "admin").First(&owner).Error; err != nil {
				return fmt.Errorf("failed to find default channel owner: %w", err)
			}
		}

		var groupCount int64
		if err := tx.Model(&ChannelGroup{}).Count(&groupCount).Error; err != nil {
			return err
		}

		var defaultGroup ChannelGroup
		err := tx.Where("name = ? AND owner_id = ?", "General", owner.ID).First(&defaultGroup).Error
		if err != nil {
			if err != gorm.ErrRecordNotFound {
				return err
			}
			if groupCount > 0 {
				return nil
			}

			// Create default channel group
			defaultGroup = ChannelGroup{
				Name:        "General",
				Description: "Default server for general discussions",
				Icon:        "💬",
				OwnerID:     owner.ID,
				InviteCode:  generateUniqueInviteCode(tx),
			}

			if err := tx.Create(&defaultGroup).Error; err != nil {
				return err
			}
		}

		if err := tx.Where("user_id = ? AND group_id = ?", owner.ID, defaultGroup.ID).FirstOrCreate(&UserGroup{
			UserID:  owner.ID,
			GroupID: defaultGroup.ID,
			Role:    "owner",
		}).Error; err != nil {
			return err
		}

		// Create text channels
		textChannels := []Channel{
			{Name: "general", Type: "text", Description: "General discussion", GroupID: defaultGroup.ID, Position: 0, CreatedBy: owner.ID},
			{Name: "random", Type: "text", Description: "Random topics and fun", GroupID: defaultGroup.ID, Position: 1, CreatedBy: owner.ID},
			{Name: "development", Type: "text", Description: "Development discussion", GroupID: defaultGroup.ID, Position: 2, CreatedBy: owner.ID},
			{Name: "design", Type: "text", Description: "Design and UI/UX", GroupID: defaultGroup.ID, Position: 3, CreatedBy: owner.ID},
		}

		for _, ch := range textChannels {
			if err := tx.Where("group_id = ? AND name = ?", ch.GroupID, ch.Name).FirstOrCreate(&ch).Error; err != nil {
				return err
			}
		}

		// Create voice channels
		voiceChannels := []Channel{
			{Name: "General Voice", Type: "voice", Description: "General voice chat", GroupID: defaultGroup.ID, Position: 0, CreatedBy: owner.ID, MaxMembers: 10},
			{Name: "Meeting Room", Type: "voice", Description: "For team meetings", GroupID: defaultGroup.ID, Position: 1, CreatedBy: owner.ID, MaxMembers: 8},
			{Name: "Gaming", Type: "voice", Description: "Gaming sessions", GroupID: defaultGroup.ID, Position: 2, CreatedBy: owner.ID, MaxMembers: 10},
		}

		for _, ch := range voiceChannels {
			if err := tx.Where("group_id = ? AND name = ?", ch.GroupID, ch.Name).FirstOrCreate(&ch).Error; err != nil {
				return err
			}
		}

		log.Println("Default channel group and channels are ready")
		return nil
	})
}

func generateUniqueInviteCode(db *gorm.DB) string {
	inviteCode := utils.GenerateInviteCode()
	for i := 0; i < 10; i++ {
		var exists int64
		if err := db.Model(&ChannelGroup{}).Where("invite_code = ?", inviteCode).Count(&exists).Error; err != nil || exists == 0 {
			return inviteCode
		}
		inviteCode = utils.GenerateInviteCode()
	}
	return inviteCode
}
