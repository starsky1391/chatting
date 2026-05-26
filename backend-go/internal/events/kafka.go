package events

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"chat-backend/internal/config"
	"chat-backend/internal/model"
	"chat-backend/internal/socket"
	"chat-backend/pkg/logger"

	"github.com/segmentio/kafka-go"
)

const (
	EventChannelMessageCreated = "channel.message.created"
	EventDirectMessageCreated  = "dm.message.created"
)

type Publisher interface {
	PublishChannelMessageCreated(ctx context.Context, channelID uint, message model.MessageResponse) error
	PublishDirectMessageCreated(ctx context.Context, conversationID uint, memberIDs []uint, message model.DirectMessageResponse) error
	Close() error
}

type NoopPublisher struct{}

func (NoopPublisher) PublishChannelMessageCreated(context.Context, uint, model.MessageResponse) error {
	return nil
}

func (NoopPublisher) PublishDirectMessageCreated(context.Context, uint, []uint, model.DirectMessageResponse) error {
	return nil
}

func (NoopPublisher) Close() error {
	return nil
}

type Event struct {
	Type       string          `json:"type"`
	Version    int             `json:"version"`
	OccurredAt time.Time       `json:"occurredAt"`
	Payload    json.RawMessage `json:"payload"`
}

type ChannelMessageCreatedPayload struct {
	ChannelID uint                  `json:"channelId"`
	Message   model.MessageResponse `json:"message"`
}

type DirectMessageCreatedPayload struct {
	ConversationID uint                        `json:"conversationId"`
	MemberIDs      []uint                      `json:"memberIds"`
	Message        model.DirectMessageResponse `json:"message"`
}

type KafkaBus struct {
	writer *kafka.Writer
	reader *kafka.Reader
	topic  string
}

func NewKafkaBus(cfg config.KafkaConfig) (*KafkaBus, error) {
	if len(cfg.Brokers) == 0 {
		return nil, errors.New("kafka brokers are empty")
	}
	if cfg.TopicEvents == "" {
		return nil, errors.New("kafka event topic is empty")
	}
	if cfg.ConsumerGroup == "" {
		return nil, errors.New("kafka consumer group is empty")
	}

	writer := kafka.NewWriter(kafka.WriterConfig{
		Brokers:      cfg.Brokers,
		Topic:        cfg.TopicEvents,
		Balancer:     &kafka.Hash{},
		RequiredAcks: int(kafka.RequireOne),
		Async:        false,
	})

	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:  cfg.Brokers,
		Topic:    cfg.TopicEvents,
		GroupID:  cfg.ConsumerGroup,
		MinBytes: 1,
		MaxBytes: 10e6,
	})

	logger.Info("Kafka event bus enabled: brokers=%v topic=%s group=%s", cfg.Brokers, cfg.TopicEvents, cfg.ConsumerGroup)
	return &KafkaBus{writer: writer, reader: reader, topic: cfg.TopicEvents}, nil
}

func (b *KafkaBus) PublishChannelMessageCreated(ctx context.Context, channelID uint, message model.MessageResponse) error {
	payload := ChannelMessageCreatedPayload{
		ChannelID: channelID,
		Message:   message,
	}
	return b.publish(ctx, EventChannelMessageCreated, fmt.Sprintf("channel-%d", channelID), payload)
}

func (b *KafkaBus) PublishDirectMessageCreated(ctx context.Context, conversationID uint, memberIDs []uint, message model.DirectMessageResponse) error {
	payload := DirectMessageCreatedPayload{
		ConversationID: conversationID,
		MemberIDs:      memberIDs,
		Message:        message,
	}
	return b.publish(ctx, EventDirectMessageCreated, fmt.Sprintf("dm-%d", conversationID), payload)
}

func (b *KafkaBus) publish(ctx context.Context, eventType, key string, payload interface{}) error {
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	event := Event{
		Type:       eventType,
		Version:    1,
		OccurredAt: time.Now().UTC(),
		Payload:    payloadBytes,
	}
	eventBytes, err := json.Marshal(event)
	if err != nil {
		return err
	}

	return b.writer.WriteMessages(ctx, kafka.Message{
		Topic: b.topic,
		Key:   []byte(key),
		Value: eventBytes,
		Time:  event.OccurredAt,
	})
}

func (b *KafkaBus) StartConsumer(ctx context.Context, hub *socket.Hub) {
	for {
		message, err := b.reader.FetchMessage(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			logger.Warn("Kafka fetch failed: %v", err)
			time.Sleep(2 * time.Second)
			continue
		}

		if err := b.dispatch(hub, message.Value); err != nil {
			logger.Warn("Kafka event dispatch failed: %v", err)
		}

		if err := b.reader.CommitMessages(ctx, message); err != nil {
			logger.Warn("Kafka commit failed: %v", err)
		}
	}
}

func (b *KafkaBus) dispatch(hub *socket.Hub, value []byte) error {
	var event Event
	if err := json.Unmarshal(value, &event); err != nil {
		return err
	}

	switch event.Type {
	case EventChannelMessageCreated:
		var payload ChannelMessageCreatedPayload
		if err := json.Unmarshal(event.Payload, &payload); err != nil {
			return err
		}
		DispatchChannelMessageCreated(hub, payload.ChannelID, payload.Message)
	case EventDirectMessageCreated:
		var payload DirectMessageCreatedPayload
		if err := json.Unmarshal(event.Payload, &payload); err != nil {
			return err
		}
		DispatchDirectMessageCreated(hub, payload.ConversationID, payload.MemberIDs, payload.Message)
	default:
		logger.Debug("Ignoring unknown Kafka event type: %s", event.Type)
	}
	return nil
}

func DispatchChannelMessageCreatedToGlobalHub(channelID uint, message model.MessageResponse) {
	DispatchChannelMessageCreated(socket.GetGlobalHub(), channelID, message)
}

func DispatchDirectMessageCreatedToGlobalHub(conversationID uint, memberIDs []uint, message model.DirectMessageResponse) {
	DispatchDirectMessageCreated(socket.GetGlobalHub(), conversationID, memberIDs, message)
}

func DispatchChannelMessageCreated(hub *socket.Hub, channelID uint, message model.MessageResponse) {
	if hub == nil {
		return
	}

	roomID := fmt.Sprintf("channel-%d", channelID)
	hub.BroadcastToRoom(roomID, &socket.Message{
		Type: "message:create",
		Room: roomID,
		Payload: map[string]interface{}{
			"channelId": channelID,
			"id":        message.ID,
			"content":   message.Content.Body,
			"createdAt": message.CreatedAt,
			"sender":    message.Sender,
			"message":   message,
		},
	}, "")
}

func DispatchDirectMessageCreated(hub *socket.Hub, conversationID uint, memberIDs []uint, message model.DirectMessageResponse) {
	if hub == nil {
		return
	}

	for _, userID := range memberIDs {
		hub.SendToUser(userID, &socket.Message{
			Type: "dm:message",
			Payload: map[string]interface{}{
				"conversationId": conversationID,
				"message":        message,
			},
		})
	}
}

func (b *KafkaBus) Close() error {
	var err error
	if b.writer != nil {
		err = errors.Join(err, b.writer.Close())
	}
	if b.reader != nil {
		err = errors.Join(err, b.reader.Close())
	}
	return err
}
