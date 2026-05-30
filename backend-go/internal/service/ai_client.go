package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"chat-backend/internal/config"
)

type aiHTTPClient struct {
	client *http.Client
}

func newAIHTTPClient(client *http.Client) *aiHTTPClient {
	if client == nil {
		client = http.DefaultClient
	}
	return &aiHTTPClient{client: client}
}

type openAIChatRequest struct {
	Model      string          `json:"model,omitempty"`
	Messages   []openAIMessage `json:"messages"`
	Tools      []openAITool    `json:"tools,omitempty"`
	ToolChoice interface{}     `json:"tool_choice,omitempty"`
	Stream     bool            `json:"stream"`
}

type openAIMessage struct {
	Role       string           `json:"role"`
	Content    *string          `json:"content,omitempty"`
	ToolCalls  []openAIToolCall `json:"tool_calls,omitempty"`
	ToolCallID string           `json:"tool_call_id,omitempty"`
}

type openAIToolCall struct {
	ID       string             `json:"id,omitempty"`
	Type     string             `json:"type"`
	Function openAIToolFunction `json:"function"`
}

type openAIToolFunction struct {
	Name      string          `json:"name"`
	Arguments json.RawMessage `json:"arguments,omitempty"`
}

type openAITool struct {
	Type     string                   `json:"type"`
	Function openAIToolFunctionSchema `json:"function"`
}

type openAIToolFunctionSchema struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Parameters  map[string]interface{} `json:"parameters"`
}

type openAIChatResponse struct {
	Choices []struct {
		Message openAIMessage `json:"message"`
		Text    string        `json:"text"`
	} `json:"choices"`
}

func (c *aiHTTPClient) askLegacy(ctx context.Context, endpoint string, prompt string, cfg config.AIConfig) (string, error) {
	payload, err := json.Marshal(buildLegacyAIRequest(cfg, prompt))
	if err != nil {
		return "", err
	}

	body, err := c.postJSON(ctx, endpoint, cfg.APIKey, payload)
	if err != nil {
		return "", err
	}

	answer := extractAIAnswer(body)
	if answer == "" {
		return "", fmt.Errorf("ai api response does not contain an answer")
	}
	return answer, nil
}

func (c *aiHTTPClient) sendOpenAIChatRequest(ctx context.Context, endpoint string, cfg config.AIConfig, messages []openAIMessage, tools []openAITool, toolChoice interface{}) (openAIChatResponse, error) {
	request := openAIChatRequest{
		Model:    cfg.Model,
		Messages: messages,
		Stream:   false,
	}
	if len(tools) > 0 {
		request.Tools = tools
		request.ToolChoice = toolChoice
	}

	payload, err := json.Marshal(request)
	if err != nil {
		return openAIChatResponse{}, err
	}

	body, err := c.postJSON(ctx, endpoint, cfg.APIKey, payload)
	if err != nil {
		return openAIChatResponse{}, err
	}

	var response openAIChatResponse
	if err := json.Unmarshal(body, &response); err != nil {
		answer := extractAIAnswer(body)
		if answer == "" {
			return openAIChatResponse{}, err
		}
		response.Choices = append(response.Choices, struct {
			Message openAIMessage `json:"message"`
			Text    string        `json:"text"`
		}{Message: openAIMessage{Role: "assistant", Content: strPtr(answer)}})
	}
	return response, nil
}

func (c *aiHTTPClient) postJSON(ctx context.Context, endpoint string, apiKey string, payload []byte) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("ai api returned %d: %s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}
	return respBody, nil
}

func buildLegacyAIRequest(cfg config.AIConfig, prompt string) interface{} {
	body := map[string]string{
		"prompt":  prompt,
		"message": prompt,
	}
	if cfg.Model != "" {
		body["model"] = cfg.Model
	}
	return body
}

func normalizeAIEndpoint(apiURL string) string {
	endpoint := strings.TrimRight(strings.TrimSpace(apiURL), "/")
	if isOpenAICompatibleEndpoint(endpoint) && !strings.HasSuffix(strings.TrimRight(endpoint, "/"), "/chat/completions") {
		endpoint += "/chat/completions"
	}
	return endpoint
}

func isOpenAICompatibleEndpoint(endpoint string) bool {
	parsed, err := url.Parse(endpoint)
	if err != nil {
		return strings.HasSuffix(endpoint, "/v1") || strings.HasSuffix(endpoint, "/chat/completions")
	}
	path := strings.TrimRight(parsed.Path, "/")
	return strings.HasSuffix(path, "/v1") || strings.HasSuffix(path, "/chat/completions")
}

func firstOpenAIMessage(response openAIChatResponse) openAIMessage {
	if len(response.Choices) == 0 {
		return openAIMessage{}
	}
	return response.Choices[0].Message
}

func firstOpenAIText(response openAIChatResponse) string {
	if len(response.Choices) == 0 {
		return ""
	}
	return response.Choices[0].Text
}

func messageContent(message openAIMessage) string {
	if message.Content == nil {
		return ""
	}
	return *message.Content
}

func strPtr(value string) *string {
	return &value
}

func extractAIAnswer(payload []byte) string {
	var raw map[string]interface{}
	if err := json.Unmarshal(payload, &raw); err != nil {
		return strings.TrimSpace(string(payload))
	}

	for _, key := range []string{"answer", "content", "message"} {
		if value, ok := raw[key].(string); ok && strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}

	if data, ok := raw["data"].(map[string]interface{}); ok {
		for _, key := range []string{"answer", "content", "message"} {
			if value, ok := data[key].(string); ok && strings.TrimSpace(value) != "" {
				return strings.TrimSpace(value)
			}
		}
	}

	choices, ok := raw["choices"].([]interface{})
	if !ok || len(choices) == 0 {
		return ""
	}
	first, ok := choices[0].(map[string]interface{})
	if !ok {
		return ""
	}
	if text, ok := first["text"].(string); ok && strings.TrimSpace(text) != "" {
		return strings.TrimSpace(text)
	}
	if message, ok := first["message"].(map[string]interface{}); ok {
		if content, ok := message["content"].(string); ok {
			return strings.TrimSpace(content)
		}
	}
	return ""
}
