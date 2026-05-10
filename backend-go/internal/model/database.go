package model

import (
	"fmt"
	"log"

	"chat-backend/internal/config"

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
	)
	if err != nil {
		return fmt.Errorf("failed to migrate database: %w", err)
	}

	log.Println("Database migrated successfully")
	return nil
}

func CreateDefaultChannels(db *gorm.DB) error {
	var count int64
	db.Model(&ChannelGroup{}).Count(&count)

	if count == 0 {
		// Create default channel group
		defaultGroup := ChannelGroup{
			Name:        "General",
			Description: "Default server for general discussions",
			Icon:        "💬",
		}

		if err := db.Create(&defaultGroup).Error; err != nil {
			return err
		}

		// Create text channels
		textChannels := []Channel{
			{Name: "general", Type: "text", Description: "General discussion", GroupID: defaultGroup.ID, Position: 0},
			{Name: "random", Type: "text", Description: "Random topics and fun", GroupID: defaultGroup.ID, Position: 1},
			{Name: "development", Type: "text", Description: "Development discussion", GroupID: defaultGroup.ID, Position: 2},
			{Name: "design", Type: "text", Description: "Design and UI/UX", GroupID: defaultGroup.ID, Position: 3},
		}

		for _, ch := range textChannels {
			if err := db.Create(&ch).Error; err != nil {
				return err
			}
		}

		// Create voice channels
		voiceChannels := []Channel{
			{Name: "General Voice", Type: "voice", Description: "General voice chat", GroupID: defaultGroup.ID, Position: 0},
			{Name: "Meeting Room", Type: "voice", Description: "For team meetings", GroupID: defaultGroup.ID, Position: 1},
			{Name: "Gaming", Type: "voice", Description: "Gaming sessions", GroupID: defaultGroup.ID, Position: 2},
		}

		for _, ch := range voiceChannels {
			if err := db.Create(&ch).Error; err != nil {
				return err
			}
		}

		log.Println("Default channel group and channels created successfully")
	}

	return nil
}