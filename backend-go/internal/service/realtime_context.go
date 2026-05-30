package service

import (
	"bytes"
	"context"
	"encoding/json"
	"encoding/xml"
	"fmt"
	stdhtml "html"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	xhtml "golang.org/x/net/html"
)

type realtimeSearchResult struct {
	Title   string
	Snippet string
	URL     string
}

type googleNewsRSS struct {
	Channel googleNewsChannel `xml:"channel"`
}

type googleNewsChannel struct {
	Title string           `xml:"title"`
	Items []googleNewsItem `xml:"item"`
}

type googleNewsItem struct {
	Title       string `xml:"title"`
	Link        string `xml:"link"`
	Description string `xml:"description"`
	PubDate     string `xml:"pubDate"`
	Source      string `xml:"source"`
}

type newsNowResponse struct {
	Status      string        `json:"status"`
	ID          string        `json:"id"`
	UpdatedTime int64         `json:"updatedTime"`
	Items       []newsNowItem `json:"items"`
}

type newsNowItem struct {
	ID        string                 `json:"id"`
	Title     string                 `json:"title"`
	URL       string                 `json:"url"`
	MobileURL string                 `json:"mobileUrl"`
	Extra     map[string]interface{} `json:"extra"`
}

type newsNowSource struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}

type espnScoreboardResponse struct {
	Leagues []struct {
		Name string `json:"name"`
	} `json:"leagues"`
	Day struct {
		Date string `json:"date"`
	} `json:"day"`
	Events []espnEvent `json:"events"`
}

type espnEvent struct {
	Name         string            `json:"name"`
	ShortName    string            `json:"shortName"`
	Date         string            `json:"date"`
	StartDate    string            `json:"startDate"`
	Notes        []espnEventNote   `json:"notes"`
	Broadcasts   []espnBroadcast   `json:"broadcasts"`
	Status       espnEventStatus   `json:"status"`
	Competitions []espnCompetition `json:"competitions"`
}

type espnEventNote struct {
	Headline string `json:"headline"`
}

type espnBroadcast struct {
	Names []string `json:"names"`
}

type espnEventStatus struct {
	Type espnStatusType `json:"type"`
}

type espnStatusType struct {
	Description string `json:"description"`
	Detail      string `json:"detail"`
	ShortDetail string `json:"shortDetail"`
	State       string `json:"state"`
}

type espnCompetition struct {
	Date        string           `json:"date"`
	Status      espnEventStatus  `json:"status"`
	Venue       espnVenue        `json:"venue"`
	Competitors []espnCompetitor `json:"competitors"`
	Broadcasts  []espnBroadcast  `json:"broadcasts"`
}

type espnVenue struct {
	FullName string `json:"fullName"`
}

type espnCompetitor struct {
	HomeAway string   `json:"homeAway"`
	Team     espnTeam `json:"team"`
	Score    string   `json:"score"`
}

type espnTeam struct {
	DisplayName  string `json:"displayName"`
	Abbreviation string `json:"abbreviation"`
}

type realtimeLeagueSpec struct {
	ScoreboardURL string
	Label         string
}

func (s *AIService) enrichPromptWithRealtimeContext(ctx context.Context, prompt string) (string, string) {
	if !needsRealtimeContext(prompt) {
		return prompt, ""
	}

	searchCtx, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()

	now := time.Now().In(hongKongLocation())
	sections := make([]string, 0, 3)

	if sports := s.buildSportsContext(searchCtx, prompt, now); sports != "" {
		sections = append(sections, "体育赛程/比分:\n"+sports)
	}

	if news := s.buildNewsContext(searchCtx, prompt, now); news != "" {
		sections = append(sections, "新闻动态:\n"+news)
	}

	if search := s.buildWebSearchContext(searchCtx, prompt, now); search != "" {
		sections = append(sections, "网页搜索摘要:\n"+search)
	}

	if len(sections) == 0 {
		return prompt, ""
	}

	var builder strings.Builder
	builder.WriteString("你是群聊里的 AI 助手。下面是系统自动获取的实时上下文，请必须依据它回答，避免编造。\n")
	builder.WriteString("重要规则: 不要说你无法实时获取信息；你已经拿到了下面的实时上下文。若上下文不足，只说明不足在哪里，并给出已检索到的信息。\n")
	builder.WriteString("检索时间: ")
	builder.WriteString(now.Format("2006-01-02 15:04"))
	builder.WriteString(" Asia/Hong_Kong\n\n")
	builder.WriteString(strings.Join(sections, "\n\n"))
	builder.WriteString("\n\n用户问题:\n")
	builder.WriteString(prompt)

	fallback := buildRealtimeFallbackAnswer(now, sections)
	return builder.String(), fallback
}

func needsRealtimeContext(prompt string) bool {
	lower := strings.ToLower(strings.TrimSpace(prompt))
	keywords := []string{
		"今天", "今日", "现在", "最新", "实时", "刚刚", "新闻", "发生", "热点", "热搜", "热榜", "头条",
		"赛程", "比赛", "比分", "赛果", "赛况",
		"today", "latest", "news", "live", "score", "scores", "schedule", "game", "match", "playoff",
		"standings", "results", "fixture",
		"nba", "nfl", "mlb", "nhl", "soccer", "football", "basketball", "baseball", "hockey",
		"英超", "欧冠", "足球", "篮球", "棒球", "冰球", "赛事",
	}
	for _, keyword := range keywords {
		if strings.Contains(lower, strings.ToLower(keyword)) {
			return true
		}
	}
	return false
}

func (s *AIService) buildSportsContext(ctx context.Context, prompt string, now time.Time) string {
	leagueSpecs := detectSportsLeagueSpecs(prompt)
	if len(leagueSpecs) == 0 {
		return ""
	}

	targetDate := now.Format("20060102")
	prevDate := now.AddDate(0, 0, -1).Format("20060102")
	sections := make([]string, 0, len(leagueSpecs))

	for _, spec := range leagueSpecs {
		lines := s.fetchESPNScoreboardLines(ctx, spec, []string{targetDate, prevDate}, now)
		if len(lines) == 0 {
			continue
		}
		sections = append(sections, fmt.Sprintf("%s:\n%s", spec.Label, strings.Join(lines, "\n")))
	}

	return strings.Join(sections, "\n\n")
}

func (s *AIService) buildNewsContext(ctx context.Context, prompt string, now time.Time) string {
	if !looksLikeNewsRequest(prompt) {
		return ""
	}

	newsQuery := extractNewsQuery(prompt)
	if newsNow := s.buildNewsNowContext(ctx, newsQuery, now); newsNow != "" {
		return newsNow
	}

	feeds := buildGoogleNewsFeedURLs(prompt)
	items := make([]string, 0, 6)
	seen := make(map[string]struct{})
	for _, feedURL := range feeds {
		for _, item := range s.fetchGoogleNewsItems(ctx, feedURL, now) {
			if _, ok := seen[item.Title]; ok {
				continue
			}
			seen[item.Title] = struct{}{}
			items = append(items, item.String())
			if len(items) >= 6 {
				return strings.Join(items, "\n")
			}
		}
	}
	return strings.Join(items, "\n")
}

func (s *AIService) buildNewsNowContext(ctx context.Context, newsQuery string, now time.Time) string {
	sources := defaultNewsNowSources()
	if inferredSources := newsNowSourcesByID(inferNewsNowSourceIDs(newsQuery)); len(inferredSources) > 0 {
		sources = inferredSources
		newsQuery = ""
	}

	allItems := make([]string, 0, 10)
	matchedItems := make([]string, 0, 8)
	seen := make(map[string]struct{})

	for _, source := range sources {
		response, ok := s.newsNowTool.fetchSource(ctx, source)
		if !ok {
			continue
		}

		updateText := formatUnixMillis(response.UpdatedTime, now)
		for index, item := range response.Items {
			if index >= 8 {
				break
			}
			title := cleanText(item.Title)
			if title == "" {
				continue
			}
			if _, exists := seen[source.ID+"|"+title]; exists {
				continue
			}
			seen[source.ID+"|"+title] = struct{}{}

			line := formatNewsNowLine(source.Label, title, firstNonEmpty(item.URL, item.MobileURL), updateText)
			if newsQuery != "" && strings.Contains(strings.ToLower(title), strings.ToLower(newsQuery)) {
				matchedItems = append(matchedItems, line)
			}
			allItems = append(allItems, line)
		}
	}

	if newsQuery != "" && len(matchedItems) > 0 {
		return "NewsNow 热点源匹配「" + newsQuery + "」:\n" + strings.Join(limitStrings(matchedItems, 8), "\n")
	}
	if len(allItems) == 0 {
		return ""
	}
	if newsQuery != "" {
		return "NewsNow 未找到精确匹配「" + newsQuery + "」的标题，以下是当前多源热点:\n" + strings.Join(limitStrings(allItems, 10), "\n")
	}
	return "NewsNow 多源热点:\n" + strings.Join(limitStrings(allItems, 10), "\n")
}

func newsNowBaseURL() string {
	if value := strings.TrimSpace(os.Getenv("NEWSNOW_API_URL")); value != "" {
		return value
	}
	return "https://newsnow.busiyi.world"
}

func defaultNewsNowSources() []newsNowSource {
	return []newsNowSource{
		{ID: "thepaper", Label: "澎湃新闻"},
		{ID: "toutiao", Label: "今日头条"},
		{ID: "cls-hot", Label: "财联社"},
		{ID: "wallstreetcn", Label: "华尔街见闻"},
		{ID: "weibo", Label: "微博热搜"},
		{ID: "zhihu", Label: "知乎热榜"},
	}
}

func allNewsNowSources() []newsNowSource {
	return []newsNowSource{
		{ID: "coolapk", Label: "酷安"},
		{ID: "bilibili-hot-search", Label: "哔哩哔哩热搜"},
		{ID: "zhihu", Label: "知乎热榜"},
		{ID: "weibo", Label: "微博热搜"},
		{ID: "toutiao", Label: "今日头条"},
		{ID: "douyin", Label: "抖音热点"},
		{ID: "github-trending-today", Label: "GitHub Trending Today"},
		{ID: "linuxdo-hot", Label: "Linux.do 热点"},
		{ID: "tieba", Label: "贴吧热议"},
		{ID: "wallstreetcn", Label: "华尔街见闻"},
		{ID: "thepaper", Label: "澎湃新闻"},
		{ID: "cls-hot", Label: "财联社"},
		{ID: "xueqiu", Label: "雪球"},
		{ID: "kuaishou", Label: "快手热点"},
	}
}

func sourceIDs(sources []newsNowSource) []string {
	result := make([]string, 0, len(sources))
	for _, source := range sources {
		result = append(result, source.ID)
	}
	return result
}

func newsNowSourcesByID(ids []string) []newsNowSource {
	if len(ids) == 0 {
		return nil
	}
	available := make(map[string]newsNowSource)
	for _, source := range allNewsNowSources() {
		available[strings.ToLower(source.ID)] = source
	}

	result := make([]newsNowSource, 0, len(ids))
	seen := make(map[string]struct{})
	for _, id := range ids {
		key := strings.ToLower(strings.TrimSpace(id))
		if key == "" {
			continue
		}
		source, ok := available[key]
		if !ok {
			continue
		}
		if _, exists := seen[source.ID]; exists {
			continue
		}
		seen[source.ID] = struct{}{}
		result = append(result, source)
	}
	return result
}

func inferNewsNowSourceIDs(prompt string) []string {
	sourceHints := []struct {
		ID      string
		Phrases []string
	}{
		{ID: "weibo", Phrases: []string{"微博", "微博热搜"}},
		{ID: "zhihu", Phrases: []string{"知乎", "知乎热榜"}},
		{ID: "toutiao", Phrases: []string{"头条", "今日头条"}},
		{ID: "thepaper", Phrases: []string{"澎湃", "澎湃新闻"}},
		{ID: "cls-hot", Phrases: []string{"财联社"}},
		{ID: "wallstreetcn", Phrases: []string{"华尔街见闻"}},
		{ID: "bilibili-hot-search", Phrases: []string{"b站", "哔哩哔哩", "bilibili"}},
		{ID: "github-trending-today", Phrases: []string{"github", "trending"}},
		{ID: "xueqiu", Phrases: []string{"雪球"}},
		{ID: "douyin", Phrases: []string{"抖音"}},
		{ID: "kuaishou", Phrases: []string{"快手"}},
		{ID: "tieba", Phrases: []string{"贴吧"}},
		{ID: "coolapk", Phrases: []string{"酷安"}},
		{ID: "linuxdo-hot", Phrases: []string{"linux.do", "linuxdo"}},
	}

	result := make([]string, 0, 3)
	lower := strings.ToLower(prompt)
	for _, hint := range sourceHints {
		for _, phrase := range hint.Phrases {
			if strings.Contains(lower, strings.ToLower(phrase)) {
				result = append(result, hint.ID)
				break
			}
		}
	}
	return dedupeStrings(result)
}

func formatNewsNowLine(source string, title string, link string, updateText string) string {
	parts := []string{source, title}
	if updateText != "" {
		parts = append(parts, "更新 "+updateText)
	}
	if link != "" {
		parts = append(parts, link)
	}
	return "- " + strings.Join(parts, " | ")
}

type formattedNewsItem struct {
	Title   string
	Source  string
	PubDate string
	URL     string
}

func (item formattedNewsItem) String() string {
	parts := []string{item.Title}
	if item.Source != "" {
		parts = append(parts, item.Source)
	}
	if item.PubDate != "" {
		parts = append(parts, item.PubDate)
	}
	if item.URL != "" {
		parts = append(parts, item.URL)
	}
	return "- " + strings.Join(parts, " | ")
}

func looksLikeNewsRequest(prompt string) bool {
	lower := strings.ToLower(prompt)
	return containsAnyPhrase(prompt, "新闻", "大新闻", "发生", "热点", "热搜", "热榜", "头条", "要闻", "最新", "微博", "知乎", "澎湃", "财联社") ||
		strings.Contains(lower, "news") ||
		strings.Contains(lower, "headline") ||
		strings.Contains(lower, "latest")
}

func looksLikeAllNewsRequest(prompt string) bool {
	return containsAnyPhrase(prompt, "全部", "所有", "全面", "全网", "汇总", "各平台", "多平台", "多源")
}

func looksLikeSourceListRequest(prompt string) bool {
	return containsAnyPhrase(prompt, "新闻源", "热点源", "数据源", "支持哪些源", "有哪些源", "source", "sources")
}

func looksLikeSportsRequest(prompt string) bool {
	lower := strings.ToLower(prompt)
	return containsAnyPhrase(prompt, "赛程", "比赛", "比分", "赛果", "赛况", "赛事", "英超", "欧冠", "足球", "篮球", "棒球", "冰球") ||
		strings.Contains(lower, "nba") ||
		strings.Contains(lower, "nfl") ||
		strings.Contains(lower, "mlb") ||
		strings.Contains(lower, "nhl") ||
		strings.Contains(lower, "score") ||
		strings.Contains(lower, "schedule") ||
		strings.Contains(lower, "fixture") ||
		strings.Contains(lower, "match")
}

func buildGoogleNewsFeedURLs(prompt string) []string {
	const topStories = "https://news.google.com/rss?hl=zh-CN&gl=CN&ceid=CN:zh-Hans"
	const hkStories = "https://news.google.com/rss?hl=zh-HK&gl=HK&ceid=HK:zh-Hant"
	newsQuery := extractNewsQuery(prompt)
	urls := make([]string, 0, 3)
	if newsQuery != "" {
		query := url.QueryEscape(newsQuery + " 新闻")
		urls = append(urls, "https://news.google.com/rss/search?q="+query+"&hl=zh-CN&gl=CN&ceid=CN:zh-Hans")
		urls = append(urls, "https://news.google.com/rss/search?q="+query+"&hl=zh-HK&gl=HK&ceid=HK:zh-Hant")
	}
	urls = append(urls, topStories, hkStories)
	return dedupeStrings(urls)
}

func extractNewsQuery(prompt string) string {
	value := stripMentionTokens(strings.Join(strings.Fields(prompt), " "))
	replacements := []string{
		"今天", "今日", "现在", "目前", "有没有", "有什么", "有", "吗", "呢", "的",
		"新闻", "大新闻", "大", "最新", "实时", "头条", "要闻", "热点", "热搜", "热榜", "发生", "关于",
		"相关", "方面", "一下", "请问", "请", "帮我", "看看", "查查", "查一下",
		"前三", "前3", "前五", "前5", "什么", "列出", "列", "注明", "来源",
		"?", "？", "，", ",", "。", ".", "！", "!",
	}
	for _, item := range replacements {
		value = strings.ReplaceAll(value, item, " ")
	}
	value = strings.Join(strings.Fields(value), " ")
	if len([]rune(value)) > 40 {
		runes := []rune(value)
		value = string(runes[:40])
	}
	return strings.TrimSpace(value)
}

func stripMentionTokens(value string) string {
	parts := strings.Fields(value)
	filtered := make([]string, 0, len(parts))
	for _, part := range parts {
		if strings.HasPrefix(part, "@") || strings.EqualFold(part, "/ai") {
			continue
		}
		filtered = append(filtered, part)
	}
	return strings.Join(filtered, " ")
}

func (s *AIService) fetchGoogleNewsItems(ctx context.Context, feedURL string, now time.Time) []formattedNewsItem {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, feedURL, nil)
	if err != nil {
		return nil
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; ChattingBot/1.0)")
	req.Header.Set("Accept", "application/rss+xml, application/xml, text/xml")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return nil
	}

	var rss googleNewsRSS
	if err := xml.Unmarshal(body, &rss); err != nil {
		return nil
	}

	items := make([]formattedNewsItem, 0, 6)
	for _, raw := range rss.Channel.Items {
		item := formatGoogleNewsItem(raw, now)
		if item.Title == "" {
			continue
		}
		items = append(items, item)
		if len(items) >= 6 {
			break
		}
	}
	return items
}

func formatGoogleNewsItem(raw googleNewsItem, now time.Time) formattedNewsItem {
	title := cleanText(stripHTML(raw.Title))
	if title == "" {
		return formattedNewsItem{}
	}

	pubDate := strings.TrimSpace(raw.PubDate)
	if parsed, err := time.Parse(time.RFC1123Z, pubDate); err == nil {
		pubDate = parsed.In(hongKongLocation()).Format("2006-01-02 15:04")
	} else if parsed, err := time.Parse(time.RFC1123, pubDate); err == nil {
		pubDate = parsed.In(hongKongLocation()).Format("2006-01-02 15:04")
	}

	return formattedNewsItem{
		Title:   title,
		Source:  cleanText(raw.Source),
		PubDate: pubDate,
		URL:     strings.TrimSpace(raw.Link),
	}
}

func detectSportsLeagueSpecs(prompt string) []realtimeLeagueSpec {
	lower := strings.ToLower(prompt)
	specs := []realtimeLeagueSpec{}
	add := func(spec realtimeLeagueSpec) {
		for _, existing := range specs {
			if existing.ScoreboardURL == spec.ScoreboardURL {
				return
			}
		}
		specs = append(specs, spec)
	}

	hasAny := func(words ...string) bool {
		for _, word := range words {
			if strings.Contains(lower, strings.ToLower(word)) {
				return true
			}
		}
		return false
	}

	if hasAny("nba", "篮球") {
		add(realtimeLeagueSpec{Label: "NBA", ScoreboardURL: "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard"})
	}
	if hasAny("nfl", "football", "美式足球", "橄榄球") {
		add(realtimeLeagueSpec{Label: "NFL", ScoreboardURL: "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"})
	}
	if hasAny("mlb", "baseball", "棒球") {
		add(realtimeLeagueSpec{Label: "MLB", ScoreboardURL: "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard"})
	}
	if hasAny("nhl", "hockey", "冰球") {
		add(realtimeLeagueSpec{Label: "NHL", ScoreboardURL: "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard"})
	}
	if hasAny("soccer", "football", "英超", "欧冠", "足球", "联赛", "世界杯", "欧联") {
		add(realtimeLeagueSpec{Label: "Soccer", ScoreboardURL: "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard"})
	}

	if len(specs) > 0 {
		return specs
	}

	if hasAny("比赛", "赛程", "比分", "赛果", "赛况", "schedule", "score", "scores", "game", "match") {
		return []realtimeLeagueSpec{
			{Label: "NBA", ScoreboardURL: "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard"},
			{Label: "MLB", ScoreboardURL: "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard"},
			{Label: "NHL", ScoreboardURL: "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard"},
			{Label: "NFL", ScoreboardURL: "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"},
		}
	}

	return nil
}

func (s *AIService) fetchESPNScoreboardLines(ctx context.Context, spec realtimeLeagueSpec, dates []string, now time.Time) []string {
	lines := make([]string, 0, 6)
	seen := make(map[string]struct{})

	for _, date := range dates {
		endpoint := spec.ScoreboardURL + "?dates=" + url.QueryEscape(date)
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
		if err != nil {
			continue
		}
		req.Header.Set("Accept", "application/json")
		req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; ChattingBot/1.0)")

		resp, err := s.client.Do(req)
		if err != nil {
			continue
		}

		body, readErr := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
		resp.Body.Close()
		if readErr != nil || resp.StatusCode < 200 || resp.StatusCode >= 300 {
			continue
		}

		var payload espnScoreboardResponse
		if err := json.Unmarshal(body, &payload); err != nil {
			continue
		}

		for _, event := range payload.Events {
			line := formatESPNEventLine(spec.Label, event, now)
			if line == "" {
				continue
			}
			key := line
			if _, ok := seen[key]; ok {
				continue
			}
			seen[key] = struct{}{}
			lines = append(lines, line)
			if len(lines) >= 4 {
				return lines
			}
		}
	}

	return lines
}

func formatESPNEventLine(leagueLabel string, event espnEvent, now time.Time) string {
	if len(event.Competitions) == 0 {
		return ""
	}

	competition := event.Competitions[0]
	home := findESPNCompetitor(competition.Competitors, "home")
	away := findESPNCompetitor(competition.Competitors, "away")
	if home == nil && away == nil {
		return ""
	}

	start := firstNonEmpty(event.Date, event.StartDate, competition.Date)
	startText := start
	if parsed, err := time.Parse(time.RFC3339, start); err == nil {
		localStart := parsed.In(hongKongLocation())
		localToday := now.In(hongKongLocation())
		if localStart.Format("2006-01-02") != localToday.Format("2006-01-02") {
			return ""
		}
		startText = localStart.Format("2006-01-02 15:04")
	}

	status := firstNonEmpty(
		competition.Status.Type.ShortDetail,
		competition.Status.Type.Detail,
		event.Status.Type.ShortDetail,
		event.Status.Type.Detail,
		event.Status.Type.Description,
	)
	if status == "" {
		status = "未知状态"
	}

	teams := make([]string, 0, 2)
	if away != nil {
		teams = append(teams, formatESPNTeam(away))
	}
	if home != nil {
		teams = append(teams, formatESPNTeam(home))
	}

	parts := []string{
		fmt.Sprintf("%s %s", leagueLabel, eventNameOrShortName(event)),
	}
	if startText != "" {
		parts = append(parts, startText)
	}
	if len(teams) > 0 {
		parts = append(parts, strings.Join(teams, " vs "))
	}
	if status != "" {
		parts = append(parts, status)
	}

	if compBroadcast := joinBroadcastNames(competition.Broadcasts); compBroadcast != "" {
		parts = append(parts, "转播 "+compBroadcast)
	} else if eventBroadcast := joinBroadcastNames(event.Broadcasts); eventBroadcast != "" {
		parts = append(parts, "转播 "+eventBroadcast)
	}

	notes := extractNoteHeadlines(event.Notes)
	if notes != "" {
		parts = append(parts, notes)
	}

	return strings.Join(parts, " | ")
}

func eventNameOrShortName(event espnEvent) string {
	if strings.TrimSpace(event.ShortName) != "" {
		return strings.TrimSpace(event.ShortName)
	}
	return strings.TrimSpace(event.Name)
}

func formatESPNTeam(competitor *espnCompetitor) string {
	if competitor == nil {
		return ""
	}
	name := competitor.Team.DisplayName
	if name == "" {
		name = competitor.Team.Abbreviation
	}
	if competitor.Score != "" {
		return fmt.Sprintf("%s %s", name, competitor.Score)
	}
	return name
}

func findESPNCompetitor(competitors []espnCompetitor, homeAway string) *espnCompetitor {
	for i := range competitors {
		if strings.EqualFold(competitors[i].HomeAway, homeAway) {
			return &competitors[i]
		}
	}
	return nil
}

func joinBroadcastNames(broadcasts []espnBroadcast) string {
	names := make([]string, 0, len(broadcasts))
	for _, broadcast := range broadcasts {
		if len(broadcast.Names) == 0 {
			continue
		}
		names = append(names, strings.Join(broadcast.Names, "/"))
	}
	return strings.Join(names, ", ")
}

func extractNoteHeadlines(notes []espnEventNote) string {
	heads := make([]string, 0, len(notes))
	for _, note := range notes {
		if trimmed := strings.TrimSpace(note.Headline); trimmed != "" {
			heads = append(heads, trimmed)
		}
	}
	return strings.Join(heads, "; ")
}

func (s *AIService) buildWebSearchContext(ctx context.Context, prompt string, now time.Time) string {
	queries := buildRealtimeSearchQueries(prompt, now)
	results := make([]realtimeSearchResult, 0, 4)
	seen := make(map[string]struct{})

	for _, query := range queries {
		items := s.fetchDuckDuckGoResults(ctx, query)
		for _, item := range items {
			key := item.URL + "|" + item.Title
			if _, ok := seen[key]; ok {
				continue
			}
			seen[key] = struct{}{}
			results = append(results, item)
			if len(results) >= 4 {
				break
			}
		}
		if len(results) >= 4 {
			break
		}
	}

	if len(results) == 0 {
		return ""
	}

	lines := make([]string, 0, len(results)+1)
	lines = append(lines, "查询: "+strings.Join(queries, " | "))
	for i, result := range results {
		lines = append(lines, fmt.Sprintf("%d. %s — %s (%s)", i+1, result.Title, result.Snippet, result.URL))
	}
	return strings.Join(lines, "\n")
}

func buildRealtimeSearchQueries(prompt string, now time.Time) []string {
	trimmed := strings.TrimSpace(prompt)
	normalized := strings.Join(strings.Fields(trimmed), " ")
	dateText := now.In(hongKongLocation()).Format("2006-01-02")
	lower := strings.ToLower(trimmed)

	queries := []string{normalized}
	if containsAnyPhrase(trimmed, "今天", "今日", "最新", "实时", "新闻", "赛程", "比赛", "比分", "结果", "赛果") ||
		strings.Contains(lower, "today") || strings.Contains(lower, "latest") || strings.Contains(lower, "news") {
		queries = append(queries, normalized+" today latest", normalized+" 最新 "+dateText)
	}
	if strings.Contains(lower, "score") || strings.Contains(lower, "schedule") || strings.Contains(trimmed, "赛程") || strings.Contains(trimmed, "比赛") {
		queries = append(queries, normalized+" schedule score "+dateText)
	}
	if len(queries) == 1 {
		queries = append(queries, normalized+" news "+dateText)
	}
	return dedupeStrings(queries)
}

func (s *AIService) fetchDuckDuckGoResults(ctx context.Context, query string) []realtimeSearchResult {
	endpoint := "https://html.duckduckgo.com/html/?q=" + url.QueryEscape(query)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; ChattingBot/1.0)")
	req.Header.Set("Accept", "text/html,application/xhtml+xml")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil || resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil
	}
	return parseDuckDuckGoResults(body, 3)
}

func parseDuckDuckGoResults(body []byte, limit int) []realtimeSearchResult {
	doc, err := xhtml.Parse(bytes.NewReader(body))
	if err != nil {
		return nil
	}

	results := make([]realtimeSearchResult, 0, limit)
	var walk func(*xhtml.Node)
	walk = func(node *xhtml.Node) {
		if len(results) >= limit {
			return
		}
		if node.Type == xhtml.ElementNode && node.Data == "div" && hasClass(node, "result__body") {
			if result, ok := extractDuckDuckGoResult(node); ok {
				results = append(results, result)
			}
		}
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			walk(child)
		}
	}
	walk(doc)
	return results
}

func extractDuckDuckGoResult(node *xhtml.Node) (realtimeSearchResult, bool) {
	result := realtimeSearchResult{}
	var walk func(*xhtml.Node)
	walk = func(n *xhtml.Node) {
		if n.Type == xhtml.ElementNode && n.Data == "a" {
			switch {
			case hasClass(n, "result__a") && result.Title == "":
				result.Title = cleanText(nodeText(n))
				if href := attrValue(n, "href"); href != "" {
					result.URL = resolveDuckDuckGoURL(href)
				}
			case hasClass(n, "result__snippet") && result.Snippet == "":
				result.Snippet = cleanText(nodeText(n))
			case hasClass(n, "result__url") && result.URL == "":
				result.URL = cleanText(nodeText(n))
			}
		}
		for child := n.FirstChild; child != nil; child = child.NextSibling {
			walk(child)
		}
	}
	walk(node)

	if result.Title == "" {
		return realtimeSearchResult{}, false
	}
	if result.URL == "" {
		result.URL = "duckduckgo.com"
	}
	if result.Snippet == "" {
		result.Snippet = "无摘要"
	}
	return result, true
}

func nodeText(node *xhtml.Node) string {
	var builder strings.Builder
	var walk func(*xhtml.Node)
	walk = func(n *xhtml.Node) {
		switch n.Type {
		case xhtml.TextNode:
			builder.WriteString(n.Data)
		case xhtml.ElementNode:
			for child := n.FirstChild; child != nil; child = child.NextSibling {
				walk(child)
			}
		}
	}
	walk(node)
	return builder.String()
}

func hasClass(node *xhtml.Node, className string) bool {
	for _, attr := range node.Attr {
		if attr.Key != "class" {
			continue
		}
		for _, cls := range strings.Fields(attr.Val) {
			if cls == className {
				return true
			}
		}
	}
	return false
}

func attrValue(node *xhtml.Node, key string) string {
	for _, attr := range node.Attr {
		if attr.Key == key {
			return attr.Val
		}
	}
	return ""
}

func resolveDuckDuckGoURL(raw string) string {
	raw = strings.TrimSpace(stdhtml.UnescapeString(raw))
	if raw == "" {
		return ""
	}
	if strings.HasPrefix(raw, "//") {
		raw = "https:" + raw
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return raw
	}
	if target := parsed.Query().Get("uddg"); target != "" {
		if decoded, err := url.QueryUnescape(target); err == nil {
			return decoded
		}
		return target
	}
	if parsed.Scheme != "" {
		return raw
	}
	if parsed.Host != "" {
		return "https://" + raw
	}
	return raw
}

func cleanText(value string) string {
	value = stdhtml.UnescapeString(strings.TrimSpace(value))
	value = strings.ReplaceAll(value, "\u00a0", " ")
	value = strings.Join(strings.Fields(value), " ")
	if len(value) > 220 {
		value = value[:220] + "..."
	}
	return value
}

func dedupeStrings(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

func stripHTML(value string) string {
	doc, err := xhtml.Parse(strings.NewReader("<div>" + value + "</div>"))
	if err != nil {
		return value
	}
	return nodeText(doc)
}

func looksLikeRealtimeRefusal(answer string) bool {
	answer = strings.ToLower(answer)
	refusals := []string{
		"无法实时", "不能实时", "无法获取最新", "无法浏览", "无法联网", "没有实时", "没有联网", "联网功能", "无法为你提供实时", "无法为您提供实时",
		"建议通过", "建议查看", "权威新闻平台", "官方新闻平台",
		"can't access real-time", "cannot access real-time", "unable to access real-time",
		"can't browse", "cannot browse", "don't have access to real-time",
	}
	for _, refusal := range refusals {
		if strings.Contains(answer, strings.ToLower(refusal)) {
			return true
		}
	}
	return false
}

func shouldUseRealtimeFallback(prompt string, answer string, fallback string) bool {
	if strings.TrimSpace(fallback) == "" {
		return false
	}
	if looksLikeRealtimeRefusal(answer) {
		return true
	}
	if looksLikeNewsRequest(prompt) && !answerLooksLikeGroundedNews(answer) {
		return true
	}
	return false
}

func answerLooksLikeGroundedNews(answer string) bool {
	answer = strings.TrimSpace(answer)
	if answer == "" {
		return false
	}
	hasDate := strings.Contains(answer, "2026-") || strings.Contains(answer, "2025-") || strings.Contains(answer, "月") || strings.Contains(answer, "日")
	hasSourceOrLink := strings.Contains(answer, "http://") || strings.Contains(answer, "https://") ||
		containsAnyPhrase(answer, "来源", "据", "新华社", "央视", "BBC", "路透", "法新社", "美联社", "半岛", "财新", "澎湃", "界面", "Google")
	hasConcreteSignal := containsAnyPhrase(answer, "称", "报道", "宣布", "表示", "发生", "举行", "通过", "发布", "确认", "袭击", "协议", "会谈")
	return hasDate && hasSourceOrLink && hasConcreteSignal
}

func buildRealtimeFallbackAnswer(now time.Time, sections []string) string {
	var builder strings.Builder
	builder.WriteString("我刚刚检索到这些实时热点（")
	builder.WriteString(now.Format("2006-01-02 15:04"))
	builder.WriteString(" HKT）：\n\n")
	for _, section := range sections {
		builder.WriteString(section)
		builder.WriteString("\n\n")
	}
	builder.WriteString("以上是项目内置实时检索拿到的内容。")
	return strings.TrimSpace(builder.String())
}

func limitStrings(values []string, limit int) []string {
	if len(values) <= limit {
		return values
	}
	return values[:limit]
}

func formatUnixMillis(value int64, now time.Time) string {
	if value <= 0 {
		return now.Format("2006-01-02 15:04")
	}
	return time.UnixMilli(value).In(hongKongLocation()).Format("2006-01-02 15:04")
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func containsAnyPhrase(value string, phrases ...string) bool {
	for _, phrase := range phrases {
		if strings.Contains(value, phrase) {
			return true
		}
	}
	return false
}

func hongKongLocation() *time.Location {
	loc, err := time.LoadLocation("Asia/Hong_Kong")
	if err != nil {
		return time.FixedZone("HKT", 8*60*60)
	}
	return loc
}
