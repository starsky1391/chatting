package service

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"chat-backend/internal/config"
)

var ErrAIAPIUnavailable = errors.New("ai api is not configured")

type AIService struct {
	cfg          config.AIConfig
	client       *http.Client
	aiClient     *aiHTTPClient
	newsNowTool  *newsNowTool
	toolRegistry *aiToolRegistry
}

func NewAIService(cfg config.AIConfig) *AIService {
	httpClient := &http.Client{
		Timeout: 45 * time.Second,
	}
	service := &AIService{
		cfg:    cfg,
		client: httpClient,
	}
	service.aiClient = newAIHTTPClient(httpClient)
	service.newsNowTool = newNewsNowTool(httpClient, time.Minute)
	service.toolRegistry = newAIToolRegistry(service.newsNowTool, newSportsTool(service.buildSportsContext))
	return service
}

type AskAIInput struct {
	Prompt string `json:"prompt" binding:"required"`
}

type AskAIResponse struct {
	Answer string `json:"answer"`
}

func (s *AIService) Ask(ctx context.Context, prompt string) (string, error) {
	return s.ask(ctx, prompt, s.cfg, "AI 接口还没有配置，请在后端环境变量设置 AI_API_URL 后重试。")
}

func (s *AIService) AskWithConfig(ctx context.Context, prompt string, cfg config.AIConfig) (string, error) {
	return s.ask(ctx, prompt, cfg, "这个群还没有配置 AI 机器人接口，请联系群主在群组设置里配置。")
}

func (s *AIService) ask(ctx context.Context, prompt string, cfg config.AIConfig, missingMessage string) (string, error) {
	prompt = strings.TrimSpace(prompt)
	if prompt == "" {
		return "请在 @AI 后面输入问题。", nil
	}
	if strings.TrimSpace(cfg.APIURL) == "" {
		return missingMessage, ErrAIAPIUnavailable
	}

	endpoint := normalizeAIEndpoint(cfg.APIURL)
	if isOpenAICompatibleEndpoint(endpoint) {
		return s.askOpenAICompatible(ctx, endpoint, prompt, cfg)
	}
	return s.askLegacy(ctx, endpoint, prompt, cfg)
}

func (s *AIService) askOpenAICompatible(ctx context.Context, endpoint string, prompt string, cfg config.AIConfig) (string, error) {
	messages := []openAIMessage{
		{
			Role: "system",
			Content: strPtr(
				"你是群聊 AI 助手。你可以调用项目内置实时工具获取 NewsNow 热点、新闻源列表和体育赛程/比分。" +
					"当用户询问今天、最新、热点、新闻、比赛、赛程或比分时，先调用工具，再基于工具结果回答。" +
					"不要声称自己无法实时获取信息；如果工具结果不足，只说明已查到什么和还缺什么。",
			),
		},
		{
			Role:    "user",
			Content: strPtr(prompt),
		},
	}

	var finalAnswer string
	for attempt := 0; attempt < 3; attempt++ {
		response, err := s.aiClient.sendOpenAIChatRequest(ctx, endpoint, cfg, messages, s.toolRegistry.schemas(), "auto")
		if err != nil {
			return "", err
		}
		message := firstOpenAIMessage(response)
		if len(message.ToolCalls) == 0 {
			finalAnswer = strings.TrimSpace(messageContent(message))
			if finalAnswer == "" {
				finalAnswer = strings.TrimSpace(firstOpenAIText(response))
			}
			if finalAnswer != "" && !shouldRetryWithDirectRealtimeContext(prompt, finalAnswer) {
				return finalAnswer, nil
			}
			break
		}

		for index := range message.ToolCalls {
			if message.ToolCalls[index].ID == "" {
				message.ToolCalls[index].ID = fmt.Sprintf("toolcall-%d-%d", attempt+1, index+1)
			}
			if message.ToolCalls[index].Type == "" {
				message.ToolCalls[index].Type = "function"
			}
		}
		messages = append(messages, message)
		for _, toolCall := range message.ToolCalls {
			result := s.toolRegistry.execute(ctx, prompt, toolCall)
			messages = append(messages, openAIMessage{
				Role:       "tool",
				ToolCallID: toolCall.ID,
				Content:    strPtr(result),
			})
		}
	}

	if needsRealtimeContext(prompt) {
		return s.askOpenAIWithDirectRealtimeContext(ctx, endpoint, prompt, cfg, finalAnswer)
	}
	if finalAnswer != "" {
		return finalAnswer, nil
	}
	return "", errors.New("ai api response does not contain an answer")
}

func (s *AIService) askOpenAIWithDirectRealtimeContext(ctx context.Context, endpoint string, prompt string, cfg config.AIConfig, previousAnswer string) (string, error) {
	enrichedPrompt, realtimeFallback := s.enrichPromptWithRealtimeContext(ctx, prompt)
	if realtimeFallback == "" {
		if previousAnswer != "" {
			return previousAnswer, nil
		}
		return "", errors.New("ai api response does not contain an answer")
	}

	messages := []openAIMessage{
		{
			Role: "system",
			Content: strPtr(
				"你是群聊 AI 助手。项目已经替你完成实时检索，请严格基于用户消息中的实时上下文回答。" +
					"不要说自己无法联网或无法获取最新信息；上下文不足时说明不足点。",
			),
		},
		{
			Role:    "user",
			Content: strPtr(enrichedPrompt),
		},
	}
	response, err := s.aiClient.sendOpenAIChatRequest(ctx, endpoint, cfg, messages, nil, nil)
	if err != nil {
		return "", err
	}
	answer := strings.TrimSpace(messageContent(firstOpenAIMessage(response)))
	if answer == "" {
		answer = strings.TrimSpace(firstOpenAIText(response))
	}
	if answer == "" || shouldUseRealtimeFallback(prompt, answer, realtimeFallback) {
		return realtimeFallback, nil
	}
	return answer, nil
}

func (s *AIService) askLegacy(ctx context.Context, endpoint string, prompt string, cfg config.AIConfig) (string, error) {
	originalPrompt := prompt
	prompt, realtimeFallback := s.enrichPromptWithRealtimeContext(ctx, prompt)

	answer, err := s.aiClient.askLegacy(ctx, endpoint, prompt, cfg)
	if err != nil {
		return "", err
	}
	if answer == "" {
		return "", errors.New("ai api response does not contain an answer")
	}
	if shouldUseRealtimeFallback(originalPrompt, answer, realtimeFallback) {
		return realtimeFallback, nil
	}
	return answer, nil
}

func shouldRetryWithDirectRealtimeContext(prompt string, answer string) bool {
	if !needsRealtimeContext(prompt) {
		return false
	}
	if looksLikeRealtimeRefusal(answer) {
		return true
	}
	return looksLikeNewsRequest(prompt) && !answerLooksLikeGroundedNews(answer)
}
