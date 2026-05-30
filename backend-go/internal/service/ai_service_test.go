package service

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"sync/atomic"
	"testing"
	"time"
)

func TestNormalizeAIEndpoint(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{
			name: "openai compatible base",
			in:   "https://api.aisz.mom/v1",
			want: "https://api.aisz.mom/v1/chat/completions",
		},
		{
			name: "openai compatible slash trimmed",
			in:   "https://api.aisz.mom/v1/",
			want: "https://api.aisz.mom/v1/chat/completions",
		},
		{
			name: "already completions endpoint",
			in:   "https://api.aisz.mom/v1/chat/completions",
			want: "https://api.aisz.mom/v1/chat/completions",
		},
		{
			name: "legacy endpoint",
			in:   "https://example.com/api/ask",
			want: "https://example.com/api/ask",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := normalizeAIEndpoint(tt.in); got != tt.want {
				t.Fatalf("normalizeAIEndpoint(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

func TestParseToolArgs(t *testing.T) {
	t.Run("object payload", func(t *testing.T) {
		var args newsNowToolArgs
		parseToolArgs(json.RawMessage(`{"source":"weibo","sources":["zhihu","weibo"]}`), &args)
		if args.Source != "weibo" {
			t.Fatalf("source = %q, want %q", args.Source, "weibo")
		}
		if !reflect.DeepEqual(args.Sources, []string{"zhihu", "weibo"}) {
			t.Fatalf("sources = %#v, want %#v", args.Sources, []string{"zhihu", "weibo"})
		}
	})

	t.Run("encoded string payload", func(t *testing.T) {
		var args sportsScheduleToolArgs
		parseToolArgs(json.RawMessage(`"{\"league\":\"NBA\",\"date\":\"2026-05-29\"}"`), &args)
		if args.League != "NBA" {
			t.Fatalf("league = %q, want %q", args.League, "NBA")
		}
		if args.Date != "2026-05-29" {
			t.Fatalf("date = %q, want %q", args.Date, "2026-05-29")
		}
	})
}

func TestInferNewsNowSourceIDs(t *testing.T) {
	got := inferNewsNowSourceIDs("帮我看看微博热搜和知乎热榜，再加一点 B站 热点")
	want := []string{"weibo", "zhihu", "bilibili-hot-search"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("inferNewsNowSourceIDs() = %#v, want %#v", got, want)
	}
}

func TestNewsNowToolCacheHit(t *testing.T) {
	var hits atomic.Int64
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		if r.URL.Path != "/api/s" {
			t.Errorf("path = %q, want /api/s", r.URL.Path)
		}
		if got := r.URL.Query().Get("id"); got != "weibo" {
			t.Errorf("id query = %q, want weibo", got)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"status":"ok",
			"id":"weibo",
			"updatedTime":1760000000000,
			"items":[{"title":"缓存热点","url":"https://example.com/hot"}]
		}`))
	}))
	defer server.Close()

	t.Setenv("NEWSNOW_API_URL", server.URL)
	tool := newNewsNowTool(server.Client(), time.Minute)
	source := newsNowSource{ID: "weibo", Label: "微博热搜"}

	for i := 0; i < 2; i++ {
		response, ok := tool.fetchSource(context.Background(), source)
		if !ok {
			t.Fatalf("fetchSource(%d) returned ok=false", i)
		}
		if len(response.Items) != 1 || response.Items[0].Title != "缓存热点" {
			t.Fatalf("unexpected response on fetch %d: %#v", i, response.Items)
		}
	}

	if got := hits.Load(); got != 1 {
		t.Fatalf("NewsNow hits = %d, want 1", got)
	}
}
