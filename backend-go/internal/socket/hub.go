package socket

import (
	"log"
	"sync"

	"github.com/gorilla/websocket"
)

// Global hub reference for broadcasting from other parts of the app
var globalHub *Hub

func SetGlobalHub(h *Hub) {
	globalHub = h
}

func GetGlobalHub() *Hub {
	return globalHub
}

type Client struct {
	ID        string
	UserID    uint
	Username  string
	AvatarUrl string
	Conn      *websocket.Conn
	Rooms     map[string]bool
}

type Room struct {
	ID      string
	Clients map[string]*Client
}

type Hub struct {
	Clients    map[string]*Client
	Rooms      map[string]*Room
	Register   chan *Client
	Unregister chan *Client
	Broadcast  chan *Message
	mu         sync.RWMutex
}

type Message struct {
	Type    string      `json:"type"`
	Room    string      `json:"room,omitempty"`
	Sender  string      `json:"sender,omitempty"`
	Payload interface{} `json:"payload,omitempty"`
}

func NewHub() *Hub {
	return &Hub{
		Clients:    make(map[string]*Client),
		Rooms:      make(map[string]*Room),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		Broadcast:  make(chan *Message),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.mu.Lock()
			h.Clients[client.ID] = client
			h.mu.Unlock()
			log.Printf("Client connected: %s (User: %s)", client.ID, client.Username)

		case client := <-h.Unregister:
			h.mu.Lock()
			if _, ok := h.Clients[client.ID]; ok {
				delete(h.Clients, client.ID)
				for roomID := range client.Rooms {
					if room, exists := h.Rooms[roomID]; exists {
						delete(room.Clients, client.ID)
					}
				}
			}
			h.mu.Unlock()
			log.Printf("Client disconnected: %s", client.ID)

		case message := <-h.Broadcast:
			h.mu.RLock()
			if message.Room != "" {
				if room, ok := h.Rooms[message.Room]; ok {
					for _, client := range room.Clients {
						client.Conn.WriteJSON(message)
					}
				}
			} else {
				// Broadcast to all clients
				for _, client := range h.Clients {
					client.Conn.WriteJSON(message)
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) JoinRoom(roomID string, client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if _, ok := h.Rooms[roomID]; !ok {
		h.Rooms[roomID] = &Room{
			ID:      roomID,
			Clients: make(map[string]*Client),
		}
	}

	h.Rooms[roomID].Clients[client.ID] = client
	client.Rooms[roomID] = true
}

func (h *Hub) LeaveRoom(roomID string, client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if room, ok := h.Rooms[roomID]; ok {
		delete(room.Clients, client.ID)
		delete(client.Rooms, roomID)
	}
}

func (h *Hub) GetRoomClients(roomID string) []*Client {
	h.mu.RLock()
	defer h.mu.RUnlock()

	var clients []*Client
	if room, ok := h.Rooms[roomID]; ok {
		for _, client := range room.Clients {
			clients = append(clients, client)
		}
	}
	return clients
}

func (h *Hub) BroadcastToRoom(roomID string, message *Message, excludeClientID string) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if room, ok := h.Rooms[roomID]; ok {
		for _, client := range room.Clients {
			// Skip the excluded client
			if excludeClientID != "" && client.ID == excludeClientID {
				continue
			}
			err := client.Conn.WriteJSON(message)
			if err != nil {
				log.Printf("Error sending message to client %s: %v", client.ID, err)
			}
		}
	}
}

// BroadcastToRoomByUser broadcasts to room, excluding all connections of a given user
func (h *Hub) BroadcastToRoomByUser(roomID string, message *Message, excludeUserID uint) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if room, ok := h.Rooms[roomID]; ok {
		for _, client := range room.Clients {
			if client.UserID == excludeUserID {
				continue
			}
			if err := client.Conn.WriteJSON(message); err != nil {
				log.Printf("Error sending message to client %s: %v", client.ID, err)
			}
		}
	}
}

// SendToUserInRoom sends a message only to a specific user within a room
func (h *Hub) SendToUserInRoom(roomID string, targetUserID uint, message *Message) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if room, ok := h.Rooms[roomID]; ok {
		for _, client := range room.Clients {
			if client.UserID == targetUserID {
				if err := client.Conn.WriteJSON(message); err != nil {
					log.Printf("Error sending message to client %s: %v", client.ID, err)
				}
			}
		}
	}
}

// BroadcastToUserChannels sends a message to all channels a user is in
func (h *Hub) BroadcastToUserChannels(userID uint, message *Message) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	// Find all rooms the user is in
	for _, client := range h.Clients {
		if client.UserID == userID {
			for roomID := range client.Rooms {
				if room, ok := h.Rooms[roomID]; ok {
					for _, c := range room.Clients {
						err := c.Conn.WriteJSON(message)
						if err != nil {
							log.Printf("Error sending message to client %s: %v", c.ID, err)
						}
					}
				}
			}
		}
	}
}