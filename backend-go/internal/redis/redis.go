package redis

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"chat-backend/internal/config"
	"chat-backend/internal/model"
	"github.com/redis/go-redis/v9"
)

type RedisClient struct {
	client *redis.Client
	ctx    context.Context
}

func NewRedisClient(cfg config.RedisConfig) (*RedisClient, error) {
	if cfg.Host == "" {
		log.Println("Redis not configured, using in-memory storage")
		return nil, nil
	}

	client := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%d", cfg.Host, cfg.Port),
		Password: cfg.Password,
		DB:       cfg.DB,
	})

	ctx := context.Background()
	if err := client.Ping(ctx).Err(); err != nil {
		log.Printf("Redis connection failed: %v", err)
		return nil, err
	}

	log.Println("Redis connected successfully")
	return &RedisClient{client: client, ctx: ctx}, nil
}

func (r *RedisClient) Set(key string, value interface{}, ttl time.Duration) error {
	if r == nil {
		return nil
	}
	return r.client.Set(r.ctx, key, value, ttl).Err()
}

func (r *RedisClient) SetNX(key string, value interface{}, ttl time.Duration) (bool, error) {
	if r == nil {
		return true, nil
	}
	return r.client.SetNX(r.ctx, key, value, ttl).Result()
}

func (r *RedisClient) Get(key string) (string, error) {
	if r == nil {
		return "", fmt.Errorf("redis is not configured")
	}
	return r.client.Get(r.ctx, key).Result()
}

func (r *RedisClient) Delete(key string) error {
	if r == nil {
		return nil
	}
	return r.client.Del(r.ctx, key).Err()
}

// User online status management with 30 second TTL for heartbeat
func (r *RedisClient) SetUserOnline(userID uint, username string) error {
	if r == nil {
		return nil
	}

	key := fmt.Sprintf("user:online:%d", userID)
	data := map[string]interface{}{
		"username": username,
		"online":   true,
		"lastSeen": time.Now().Unix(),
	}

	jsonData, _ := json.Marshal(data)
	// 30 second TTL - user must send heartbeat within 30 seconds to stay online
	return r.client.Set(r.ctx, key, jsonData, 30*time.Second).Err()
}

func (r *RedisClient) SetUserOffline(userID uint) error {
	if r == nil {
		return nil
	}

	key := fmt.Sprintf("user:online:%d", userID)
	data := map[string]interface{}{
		"online":   false,
		"lastSeen": time.Now().Unix(),
	}

	jsonData, _ := json.Marshal(data)
	return r.client.Set(r.ctx, key, jsonData, 24*time.Hour).Err()
}

func (r *RedisClient) IsUserOnline(userID uint) bool {
	if r == nil {
		return false
	}

	key := fmt.Sprintf("user:online:%d", userID)
	data, err := r.client.Get(r.ctx, key).Result()
	if err != nil {
		// Key doesn't exist or error - user hasn't sent heartbeat recently
		return false
	}

	var status map[string]interface{}
	json.Unmarshal([]byte(data), &status)
	if online, ok := status["online"].(bool); ok {
		return online
	}
	return false
}

// GetUserOnlineStatus returns the full online status info for a user
func (r *RedisClient) GetUserOnlineStatus(userID uint) (bool, int64) {
	if r == nil {
		return false, 0
	}

	key := fmt.Sprintf("user:online:%d", userID)
	data, err := r.client.Get(r.ctx, key).Result()
	if err != nil {
		return false, 0
	}

	var status map[string]interface{}
	json.Unmarshal([]byte(data), &status)

	online := false
	lastSeen := int64(0)

	if o, ok := status["online"].(bool); ok {
		online = o
	}
	if ls, ok := status["lastSeen"].(float64); ok {
		lastSeen = int64(ls)
	}

	return online, lastSeen
}

func (r *RedisClient) GetOnlineUsers() ([]uint, error) {
	if r == nil {
		return []uint{}, nil
	}

	keys, err := r.client.Keys(r.ctx, "user:online:*").Result()
	if err != nil {
		return nil, err
	}

	var userIDs []uint
	for _, key := range keys {
		var id uint
		fmt.Sscanf(key, "user:online:%d", &id)
		if r.IsUserOnline(id) {
			userIDs = append(userIDs, id)
		}
	}
	return userIDs, nil
}

// Channel group sync for real-time updates
func (r *RedisClient) PublishChannelUpdate(groupID uint, channel model.Channel) error {
	if r == nil {
		return nil
	}

	channelData, _ := json.Marshal(channel)
	return r.client.Publish(r.ctx, fmt.Sprintf("channel:update:%d", groupID), channelData).Err()
}

func (r *RedisClient) SubscribeChannelUpdates(groupID uint) *redis.PubSub {
	if r == nil {
		return nil
	}

	return r.client.Subscribe(r.ctx, fmt.Sprintf("channel:update:%d", groupID))
}

// Voice channel participants
func (r *RedisClient) JoinVoiceChannel(channelID uint, userID uint, username string) error {
	if r == nil {
		return nil
	}

	key := fmt.Sprintf("voice:channel:%d:participants", channelID)
	data := map[string]interface{}{
		"userId":   userID,
		"username": username,
		"joinedAt": time.Now().Unix(),
	}

	jsonData, _ := json.Marshal(data)
	return r.client.HSet(r.ctx, key, fmt.Sprintf("%d", userID), jsonData).Err()
}

func (r *RedisClient) LeaveVoiceChannel(channelID uint, userID uint) error {
	if r == nil {
		return nil
	}

	key := fmt.Sprintf("voice:channel:%d:participants", channelID)
	return r.client.HDel(r.ctx, key, fmt.Sprintf("%d", userID)).Err()
}

func (r *RedisClient) GetVoiceChannelParticipants(channelID uint) ([]map[string]interface{}, error) {
	if r == nil {
		return []map[string]interface{}{}, nil
	}

	key := fmt.Sprintf("voice:channel:%d:participants", channelID)
	data, err := r.client.HGetAll(r.ctx, key).Result()
	if err != nil {
		return nil, err
	}

	var participants []map[string]interface{}
	for _, v := range data {
		var p map[string]interface{}
		json.Unmarshal([]byte(v), &p)
		participants = append(participants, p)
	}
	return participants, nil
}

func (r *RedisClient) IsVoiceChannelParticipant(channelID uint, userID uint) bool {
	if r == nil {
		return false
	}

	key := fmt.Sprintf("voice:channel:%d:participants", channelID)
	return r.client.HExists(r.ctx, key, fmt.Sprintf("%d", userID)).Val()
}

// Group members cache
func (r *RedisClient) CacheGroupMembers(groupID uint, members []model.User) error {
	if r == nil {
		return nil
	}

	key := fmt.Sprintf("group:%d:members", groupID)
	data, _ := json.Marshal(members)
	return r.client.Set(r.ctx, key, data, 10*time.Minute).Err()
}

func (r *RedisClient) GetCachedGroupMembers(groupID uint) ([]model.User, error) {
	if r == nil {
		return []model.User{}, nil
	}

	key := fmt.Sprintf("group:%d:members", groupID)
	data, err := r.client.Get(r.ctx, key).Result()
	if err != nil {
		return nil, err
	}

	var members []model.User
	json.Unmarshal([]byte(data), &members)
	return members, nil
}

// Channel members management (real-time)
func (r *RedisClient) JoinTextChannel(channelID uint, userID uint, username string, avatarUrl string) error {
	if r == nil {
		return nil
	}

	key := fmt.Sprintf("channel:%d:members", channelID)
	data := map[string]interface{}{
		"userId":    userID,
		"username":  username,
		"avatarUrl": avatarUrl,
		"joinedAt":  time.Now().Unix(),
	}

	jsonData, _ := json.Marshal(data)
	return r.client.HSet(r.ctx, key, fmt.Sprintf("%d", userID), jsonData).Err()
}

func (r *RedisClient) LeaveTextChannel(channelID uint, userID uint) error {
	if r == nil {
		return nil
	}

	key := fmt.Sprintf("channel:%d:members", channelID)
	return r.client.HDel(r.ctx, key, fmt.Sprintf("%d", userID)).Err()
}

func (r *RedisClient) GetTextChannelMembers(channelID uint) ([]map[string]interface{}, error) {
	if r == nil {
		return []map[string]interface{}{}, nil
	}

	key := fmt.Sprintf("channel:%d:members", channelID)
	data, err := r.client.HGetAll(r.ctx, key).Result()
	if err != nil {
		return nil, err
	}

	var members []map[string]interface{}
	for _, v := range data {
		var m map[string]interface{}
		json.Unmarshal([]byte(v), &m)
		// Add isOnline status from Redis
		if userID, ok := m["userId"].(float64); ok {
			m["isOnline"] = r.IsUserOnline(uint(userID))
		}
		members = append(members, m)
	}
	return members, nil
}

func (r *RedisClient) ClearTextChannelMembers(channelID uint) error {
	if r == nil {
		return nil
	}

	key := fmt.Sprintf("channel:%d:members", channelID)
	return r.client.Del(r.ctx, key).Err()
}
