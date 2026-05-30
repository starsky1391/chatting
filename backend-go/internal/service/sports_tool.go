package service

import (
	"context"
	"time"
)

type sportsTool struct {
	buildContext func(context.Context, string, time.Time) string
}

type sportsScheduleToolArgs struct {
	League string `json:"league"`
	Date   string `json:"date"`
}

func newSportsTool(buildContext func(context.Context, string, time.Time) string) *sportsTool {
	return &sportsTool{buildContext: buildContext}
}

func (t *sportsTool) execute(ctx context.Context, query string) string {
	now := time.Now().In(hongKongLocation())
	if t == nil || t.buildContext == nil {
		return marshalToolResult(map[string]interface{}{
			"tool":      "get_sports_schedule",
			"status":    "error",
			"checkedAt": now.Format("2006-01-02 15:04 Asia/Hong_Kong"),
			"error":     "sports tool is unavailable",
		})
	}

	result := t.buildContext(ctx, query, now)
	if result == "" {
		return marshalToolResult(map[string]interface{}{
			"tool":      "get_sports_schedule",
			"status":    "empty",
			"checkedAt": now.Format("2006-01-02 15:04 Asia/Hong_Kong"),
			"message":   "没有获取到匹配的今日赛程或比分。",
		})
	}
	return marshalToolResult(map[string]interface{}{
		"tool":      "get_sports_schedule",
		"status":    "ok",
		"checkedAt": now.Format("2006-01-02 15:04 Asia/Hong_Kong"),
		"content":   result,
	})
}
