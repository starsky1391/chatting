package service

import (
	"context"
	"os"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"chat-backend/internal/model"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type queryCounterLogger struct {
	count atomic.Int64
}

func (l *queryCounterLogger) LogMode(logger.LogLevel) logger.Interface {
	return l
}

func (l *queryCounterLogger) Info(context.Context, string, ...interface{})  {}
func (l *queryCounterLogger) Warn(context.Context, string, ...interface{})  {}
func (l *queryCounterLogger) Error(context.Context, string, ...interface{}) {}

func (l *queryCounterLogger) Trace(_ context.Context, _ time.Time, fc func() (string, int64), _ error) {
	sql, _ := fc()
	if strings.TrimSpace(sql) != "" {
		l.count.Add(1)
	}
}

func (l *queryCounterLogger) Count() int64 {
	return l.count.Load()
}

func openServiceTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	dsn := os.Getenv("CHAT_TEST_DSN")
	if dsn == "" {
		dsn = "host=localhost user=postgres password=postgres123 dbname=chat_app port=5432 sslmode=disable"
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Skipf("skip integration test, postgres is not available: %v", err)
	}

	if err := db.AutoMigrate(
		&model.User{},
		&model.ChannelGroup{},
		&model.Channel{},
		&model.UserGroup{},
		&model.Message{},
		&model.GroupRole{},
		&model.GroupAIConfig{},
	); err != nil {
		t.Fatalf("migrate test schema: %v", err)
	}

	return db
}

func cleanupServiceTestData(t *testing.T, db *gorm.DB, prefix string) {
	t.Helper()

	t.Cleanup(func() {
		var groups []model.ChannelGroup
		_ = db.Unscoped().Where("name LIKE ?", prefix+"%").Find(&groups).Error
		for _, group := range groups {
			_ = db.Unscoped().Where("channel_id IN (SELECT id FROM channels WHERE group_id = ?)", group.ID).Delete(&model.Message{}).Error
			_ = db.Unscoped().Where("group_id = ?", group.ID).Delete(&model.UserGroup{}).Error
			_ = db.Unscoped().Where("group_id = ?", group.ID).Delete(&model.GroupRole{}).Error
			_ = db.Unscoped().Where("group_id = ?", group.ID).Delete(&model.GroupAIConfig{}).Error
			_ = db.Unscoped().Where("group_id = ?", group.ID).Delete(&model.Channel{}).Error
			_ = db.Unscoped().Delete(&model.ChannelGroup{}, group.ID).Error
		}
		_ = db.Unscoped().Where("email LIKE ?", prefix+"%@example.test").Delete(&model.User{}).Error
	})
}
