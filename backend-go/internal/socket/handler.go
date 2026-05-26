package socket

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"

	"chat-backend/internal/model"
	"chat-backend/internal/redis"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
}

var redisClient *redis.RedisClient
var userRepo UserRepository

// UserRepository interface for getting user info
type UserRepository interface {
	FindByID(id uint) (*model.User, error)
}

func SetRedisClient(client *redis.RedisClient) {
	redisClient = client
}

func SetUserRepository(repo UserRepository) {
	userRepo = repo
}

func HandleWebSocket(hub *Hub, c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	// Get user info from context (set by auth middleware)
	userID := c.GetUint("userID")
	username := c.GetString("username")

	// Get avatarUrl from database if userRepo is set
	var avatarUrl string
	if userRepo != nil {
		user, err := userRepo.FindByID(userID)
		if err == nil {
			avatarUrl = user.AvatarURL
		}
	}

	client := &Client{
		ID:        conn.RemoteAddr().String(),
		UserID:    userID,
		Username:  username,
		AvatarUrl: avatarUrl,
		Conn:      conn,
		Rooms:     make(map[string]bool),
	}

	hub.Register <- client

	// Read messages from client
	go func() {
		defer func() {
			hub.Unregister <- client
			conn.Close()
		}()

		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				log.Printf("Read error: %v", err)
				break
			}

			var msg map[string]interface{}
			if err := json.Unmarshal(message, &msg); err != nil {
				log.Printf("JSON unmarshal error: %v", err)
				continue
			}

			// Handle different message types
			msgType, ok := msg["type"].(string)
			if !ok {
				continue
			}

			switch msgType {
			case "heartbeat":
				// Update user's last seen time
				if redisClient != nil {
					redisClient.SetUserOnline(userID, username)
				}

			case "join-channel":
				if channelID, ok := msg["channelId"].(float64); ok {
					roomID := fmt.Sprintf("channel-%d", int(channelID))
					hub.JoinRoom(roomID, client)

					// Add to Redis channel members
					if redisClient != nil {
						redisClient.JoinTextChannel(uint(channelID), userID, username, avatarUrl)
					}

					// Get current channel members from Redis
					var members []map[string]interface{}
					if redisClient != nil {
						members, _ = redisClient.GetTextChannelMembers(uint(channelID))
					}

					// Send current members to the joining user
					client.Conn.WriteJSON(&Message{
						Type: "channel:members",
						Payload: map[string]interface{}{
							"channelId": int(channelID),
							"members":   members,
						},
					})

					// Notify others in the room
					hub.BroadcastToRoom(roomID, &Message{
						Type: "user:joined",
						Payload: map[string]interface{}{
							"userId":    userID,
							"username":  username,
							"avatarUrl": avatarUrl,
							"channelId": int(channelID),
						},
					}, client.ID)
				}

			case "leave-channel":
				if channelID, ok := msg["channelId"].(float64); ok {
					roomID := fmt.Sprintf("channel-%d", int(channelID))
					hub.LeaveRoom(roomID, client)

					// Remove from Redis channel members
					if redisClient != nil {
						redisClient.LeaveTextChannel(uint(channelID), userID)
					}

					// Notify others in the room
					hub.BroadcastToRoom(roomID, &Message{
						Type: "user:left",
						Payload: map[string]interface{}{
							"userId":    userID,
							"username":  username,
							"channelId": int(channelID),
						},
					}, client.ID)
				}

			case "send-message":
				if channelID, ok := msg["channelId"].(float64); ok {
					log.Printf("Ignoring legacy send-message for channel %d from user %d; messages must be persisted over HTTP", int(channelID), userID)
					client.Conn.WriteJSON(&Message{
						Type: "message:error",
						Payload: map[string]interface{}{
							"channelId": int(channelID),
							"message":   "send messages through POST /api/channels/:id/messages",
						},
					})
				}

			case "voice:join":
				if channelID, ok := msg["channelId"].(float64); ok {
					roomID := fmt.Sprintf("voice-channel-%d", int(channelID))
					channelUint := uint(channelID)

					// 获取房间内已有参与者(在加入之前)
					existing := hub.GetRoomClients(roomID)
					existingPayload := make([]map[string]interface{}, 0, len(existing))
					seen := map[uint]bool{}
					for _, c := range existing {
						if c.UserID == userID || seen[c.UserID] {
							continue
						}
						seen[c.UserID] = true
						existingPayload = append(existingPayload, map[string]interface{}{
							"userId":    c.UserID,
							"username":  c.Username,
							"avatarUrl": c.AvatarUrl,
						})
					}
					log.Printf("[voice:join] user=%d(%s) channel=%d existing=%d", userID, username, int(channelID), len(existingPayload))

					if redisClient != nil {
						_ = redisClient.JoinVoiceChannel(channelUint, userID, username)
					}

					hub.JoinRoom(roomID, client)

					var participants []map[string]interface{}
					if redisClient != nil {
						participants, _ = redisClient.GetVoiceChannelParticipants(channelUint)
					}
					participantCount := len(participants)

					// 把房间已有参与者列表发给新加入者,让其主动发 offer
					if err := client.Conn.WriteJSON(&Message{
						Type: "voice:participants",
						Payload: map[string]interface{}{
							"channelId":    int(channelID),
							"participants": existingPayload,
						},
					}); err != nil {
						log.Printf("[voice:join] write participants err: %v", err)
					}

					// 通知房间里其他人(不含自己),所有连接都通知
					hub.BroadcastToRoomByUser(roomID, &Message{
						Type: "voice:user-joined",
						Payload: map[string]interface{}{
							"userId":    userID,
							"senderId":  userID,
							"username":  username,
							"avatarUrl": avatarUrl,
							"channelId": int(channelID),
						},
					}, userID)

					// 广播到文本频道房间，让未加入通话的人也能看到
					textRoomID := fmt.Sprintf("channel-%d", int(channelID))
					hub.BroadcastToRoom(textRoomID, &Message{
						Type: "voice:call-status",
						Payload: map[string]interface{}{
							"channelId":       int(channelID),
							"userId":          userID,
							"username":        username,
							"avatarUrl":       avatarUrl,
							"action":          "join",
							"participantCount": participantCount,
						},
					}, "")
					hub.Broadcast <- &Message{
						Type: "voice:call-status",
						Payload: map[string]interface{}{
							"channelId":       int(channelID),
							"userId":          userID,
							"username":        username,
							"avatarUrl":       avatarUrl,
							"action":          "join",
							"participantCount": participantCount,
						},
					}
				}

			case "voice:leave":
				if channelID, ok := msg["channelId"].(float64); ok {
					roomID := fmt.Sprintf("voice-channel-%d", int(channelID))
					channelUint := uint(channelID)

					if redisClient != nil {
						_ = redisClient.LeaveVoiceChannel(channelUint, userID)
					}

					hub.LeaveRoom(roomID, client)

					var participants []map[string]interface{}
					if redisClient != nil {
						participants, _ = redisClient.GetVoiceChannelParticipants(channelUint)
					}
					participantCount := len(participants)

					hub.BroadcastToRoom(roomID, &Message{
						Type: "voice:user-left",
						Payload: map[string]interface{}{
							"userId":    userID,
							"channelId": int(channelID),
						},
					}, "")

					// 广播到文本频道房间，让未加入通话的人也能看到
					textRoomID := fmt.Sprintf("channel-%d", int(channelID))
					hub.BroadcastToRoom(textRoomID, &Message{
						Type: "voice:call-status",
						Payload: map[string]interface{}{
							"channelId":       int(channelID),
							"userId":          userID,
							"username":        username,
							"action":          "leave",
							"participantCount": participantCount,
						},
					}, "")
					hub.Broadcast <- &Message{
						Type: "voice:call-status",
						Payload: map[string]interface{}{
							"channelId":       int(channelID),
							"userId":          userID,
							"username":        username,
							"action":          "leave",
							"participantCount": participantCount,
						},
					}
				}

			case "voice:signal":
				if channelID, ok := msg["channelId"].(float64); ok {
					roomID := fmt.Sprintf("voice-channel-%d", int(channelID))
					msg["senderId"] = userID
					sigType, _ := msg["signalType"].(string)
					if sigType == "" {
						sigType, _ = msg["type"].(string)
					}
					// 定向转发：只发给 targetUserId,而不是广播到整个房间
					if targetUserID, ok := msg["targetUserId"].(float64); ok {
						log.Printf("[voice:signal] %s from=%d to=%d channel=%d", sigType, userID, int(targetUserID), int(channelID))
						hub.SendToUserInRoom(roomID, uint(targetUserID), &Message{
							Type:    "voice:signal",
							Payload: msg,
						})
					} else {
						hub.BroadcastToRoom(roomID, &Message{
							Type:    "voice:signal",
							Payload: msg,
						}, client.ID)
					}
				}
			}
		}
	}()
}

// Helper function to parse channel ID from room ID
func parseChannelID(roomID string) uint {
	var id int
	fmt.Sscanf(roomID, "channel-%d", &id)
	return uint(id)
}

// Helper for string conversion
func strconvItoa(i int) string {
	return strconv.Itoa(i)
}
