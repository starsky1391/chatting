package service

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

type newsNowTool struct {
	client   *http.Client
	cacheTTL time.Duration

	cacheMu sync.RWMutex
	cache   map[string]newsNowCacheEntry

	locksMu sync.Mutex
	locks   map[string]*sync.Mutex
}

type newsNowToolArgs struct {
	Source  string   `json:"source"`
	Sources []string `json:"sources"`
}

type newsNowCacheEntry struct {
	response  newsNowResponse
	expiresAt time.Time
}

func newNewsNowTool(client *http.Client, cacheTTL time.Duration) *newsNowTool {
	if client == nil {
		client = http.DefaultClient
	}
	if cacheTTL <= 0 {
		cacheTTL = time.Minute
	}
	return &newsNowTool{
		client:   client,
		cacheTTL: cacheTTL,
		cache:    make(map[string]newsNowCacheEntry),
		locks:    make(map[string]*sync.Mutex),
	}
}

func (t *newsNowTool) buildResult(ctx context.Context, sourceIDs []string) string {
	if t == nil {
		return marshalToolResult(map[string]interface{}{
			"tool":   "newsnow",
			"status": "error",
			"error":  "newsnow tool is unavailable",
		})
	}

	sources := newsNowSourcesByID(sourceIDs)
	if len(sources) == 0 {
		sources = defaultNewsNowSources()
	}

	type toolItem struct {
		Title string `json:"title"`
		URL   string `json:"url,omitempty"`
	}
	type toolSource struct {
		ID        string     `json:"id"`
		Label     string     `json:"label"`
		UpdatedAt string     `json:"updatedAt,omitempty"`
		Items     []toolItem `json:"items"`
	}

	now := time.Now().In(hongKongLocation())
	result := struct {
		Tool      string       `json:"tool"`
		Status    string       `json:"status"`
		CheckedAt string       `json:"checkedAt"`
		Sources   []toolSource `json:"sources"`
	}{
		Tool:      "newsnow",
		Status:    "ok",
		CheckedAt: now.Format("2006-01-02 15:04 Asia/Hong_Kong"),
		Sources:   make([]toolSource, 0, len(sources)),
	}

	for _, source := range sources {
		response, ok := t.fetchSource(ctx, source)
		if !ok {
			continue
		}
		sourceResult := toolSource{
			ID:        source.ID,
			Label:     source.Label,
			UpdatedAt: formatUnixMillis(response.UpdatedTime, now),
			Items:     make([]toolItem, 0, 8),
		}
		for index, item := range response.Items {
			if index >= 8 {
				break
			}
			title := cleanText(item.Title)
			if title == "" {
				continue
			}
			sourceResult.Items = append(sourceResult.Items, toolItem{
				Title: title,
				URL:   firstNonEmpty(item.URL, item.MobileURL),
			})
		}
		if len(sourceResult.Items) > 0 {
			result.Sources = append(result.Sources, sourceResult)
		}
	}

	if len(result.Sources) == 0 {
		result.Status = "empty"
	}
	return marshalToolResult(result)
}

func (t *newsNowTool) fetchSource(ctx context.Context, source newsNowSource) (newsNowResponse, bool) {
	if t == nil {
		return newsNowResponse{}, false
	}
	baseURL := strings.TrimRight(newsNowBaseURL(), "/")
	cacheKey := baseURL + "|" + source.ID
	if cached, ok := t.getCachedSource(cacheKey); ok {
		return cached, true
	}

	lock := t.sourceLock(cacheKey)
	lock.Lock()
	defer lock.Unlock()

	if cached, ok := t.getCachedSource(cacheKey); ok {
		return cached, true
	}

	endpoint := baseURL + "/api/s?id=" + url.QueryEscape(source.ID) + "&latest"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return newsNowResponse{}, false
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; ChattingBot/1.0)")

	resp, err := t.client.Do(req)
	if err != nil {
		return newsNowResponse{}, false
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return newsNowResponse{}, false
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return newsNowResponse{}, false
	}

	var result newsNowResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return newsNowResponse{}, false
	}
	if len(result.Items) == 0 {
		return newsNowResponse{}, false
	}
	t.setCachedSource(cacheKey, result)
	return result, true
}

func (t *newsNowTool) getCachedSource(key string) (newsNowResponse, bool) {
	if t == nil {
		return newsNowResponse{}, false
	}
	t.cacheMu.RLock()
	entry, ok := t.cache[key]
	t.cacheMu.RUnlock()
	if !ok || time.Now().After(entry.expiresAt) {
		return newsNowResponse{}, false
	}
	return entry.response, true
}

func (t *newsNowTool) setCachedSource(key string, response newsNowResponse) {
	if t == nil {
		return
	}
	t.cacheMu.Lock()
	t.cache[key] = newsNowCacheEntry{
		response:  response,
		expiresAt: time.Now().Add(t.cacheTTL),
	}
	t.cacheMu.Unlock()
}

func (t *newsNowTool) sourceLock(key string) *sync.Mutex {
	t.locksMu.Lock()
	defer t.locksMu.Unlock()
	lock, ok := t.locks[key]
	if !ok {
		lock = &sync.Mutex{}
		t.locks[key] = lock
	}
	return lock
}
