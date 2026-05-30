package service

import (
	"context"
	"encoding/json"
	"strings"
	"time"
)

type aiToolRegistry struct {
	newsNow *newsNowTool
	sports  *sportsTool
}

func newAIToolRegistry(newsNow *newsNowTool, sports *sportsTool) *aiToolRegistry {
	return &aiToolRegistry{
		newsNow: newsNow,
		sports:  sports,
	}
}

func (r *aiToolRegistry) schemas() []openAITool {
	return []openAITool{
		buildFunctionTool(
			"get_newsnow",
			"获取一个 NewsNow 热点源的最新内容。适合查询微博热搜、知乎热榜、头条、澎湃、财联社等来源。",
			map[string]interface{}{
				"type":     "object",
				"required": []string{"source"},
				"properties": map[string]interface{}{
					"source": map[string]interface{}{
						"type":        "string",
						"description": "NewsNow source id，例如 weibo、zhihu、toutiao、thepaper、cls-hot、wallstreetcn。",
					},
				},
			},
		),
		buildFunctionTool(
			"get_multi_news",
			"获取多个 NewsNow 热点源的最新内容。用户问今天热点、现在发生了什么、最新新闻时优先使用。",
			map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"sources": map[string]interface{}{
						"type":        "array",
						"description": "NewsNow source ids。为空时使用项目默认热点源。",
						"items": map[string]interface{}{
							"type": "string",
						},
					},
				},
			},
		),
		buildFunctionTool(
			"get_all_news",
			"获取项目支持的全部 NewsNow 热点源最新内容。适合用户要求全面汇总热点。",
			map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		),
		buildFunctionTool(
			"list_sources",
			"列出项目默认支持的 NewsNow 新闻/热点来源。",
			map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		),
		buildFunctionTool(
			"get_sports_schedule",
			"获取今天的体育比赛赛程、比分或赛况。支持 NBA、NFL、MLB、NHL、英超足球等。",
			map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"league": map[string]interface{}{
						"type":        "string",
						"description": "联赛名称，例如 NBA、NFL、MLB、NHL、soccer、英超。可为空，后端会从用户问题推断。",
					},
					"date": map[string]interface{}{
						"type":        "string",
						"description": "目标日期，YYYY-MM-DD。当前实现优先返回今天相关赛程，可为空。",
					},
				},
			},
		),
	}
}

func (r *aiToolRegistry) execute(ctx context.Context, prompt string, toolCall openAIToolCall) string {
	toolCtx, cancel := context.WithTimeout(ctx, 12*time.Second)
	defer cancel()

	if r == nil {
		return marshalToolResult(map[string]interface{}{
			"tool":   toolCall.Function.Name,
			"status": "error",
			"error":  "tool registry is unavailable",
		})
	}

	if looksLikeNewsRequest(prompt) && !looksLikeSportsRequest(prompt) && toolCall.Function.Name == "get_sports_schedule" {
		return r.newsNow.buildResult(toolCtx, inferNewsNowSourceIDs(prompt))
	}

	switch toolCall.Function.Name {
	case "get_newsnow":
		var args newsNowToolArgs
		parseToolArgs(toolCall.Function.Arguments, &args)
		return r.newsNow.buildResult(toolCtx, []string{args.Source})
	case "get_multi_news":
		var args newsNowToolArgs
		parseToolArgs(toolCall.Function.Arguments, &args)
		if len(args.Sources) == 0 {
			args.Sources = inferNewsNowSourceIDs(prompt)
		}
		return r.newsNow.buildResult(toolCtx, args.Sources)
	case "get_all_news":
		return r.newsNow.buildResult(toolCtx, sourceIDs(allNewsNowSources()))
	case "list_sources":
		return marshalToolResult(map[string]interface{}{
			"tool":    "list_sources",
			"sources": allNewsNowSources(),
		})
	case "get_sports_schedule":
		var args sportsScheduleToolArgs
		parseToolArgs(toolCall.Function.Arguments, &args)
		query := strings.TrimSpace(args.League + " " + args.Date + " " + prompt)
		return r.sports.execute(toolCtx, query)
	default:
		return marshalToolResult(map[string]interface{}{
			"tool":   toolCall.Function.Name,
			"status": "error",
			"error":  "unknown tool",
		})
	}
}

func buildFunctionTool(name string, description string, parameters map[string]interface{}) openAITool {
	return openAITool{
		Type: "function",
		Function: openAIToolFunctionSchema{
			Name:        name,
			Description: description,
			Parameters:  parameters,
		},
	}
}

func parseToolArgs(raw json.RawMessage, target interface{}) {
	if len(raw) == 0 {
		return
	}
	if err := json.Unmarshal(raw, target); err == nil {
		return
	}
	var encoded string
	if err := json.Unmarshal(raw, &encoded); err == nil {
		_ = json.Unmarshal([]byte(encoded), target)
	}
}

func marshalToolResult(value interface{}) string {
	payload, err := json.Marshal(value)
	if err != nil {
		return `{"status":"error","error":"failed to encode tool result"}`
	}
	return string(payload)
}
