package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"crypto/tls"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/big"
	"net"
	"net/mail"
	"net/smtp"
	"strings"
	"sync"
	"time"

	"chat-backend/internal/config"
	"chat-backend/internal/redis"
	"chat-backend/internal/repository"
	"chat-backend/pkg/logger"

	"github.com/segmentio/kafka-go"
	"gorm.io/gorm"
)

const (
	emailVerificationPurposeRegister      = "register"
	emailVerificationPurposeResetPassword = "reset-password"
)

type EmailCodeInput struct {
	Email string `json:"email" binding:"required,email"`
}

type EmailVerificationService struct {
	userRepo *repository.UserRepository
	cfg      config.EmailConfig
	kafkaCfg config.KafkaConfig
	redis    *redis.RedisClient
	queue    chan emailJob
	writer   *kafka.Writer
	reader   *kafka.Reader

	mu        sync.Mutex
	codes     map[string]memoryEmailCode
	cooldowns map[string]time.Time
}

type emailJob struct {
	Email     string    `json:"email"`
	Code      string    `json:"code"`
	Purpose   string    `json:"purpose"`
	ExpiresAt time.Time `json:"expiresAt"`
}

type memoryEmailCode struct {
	Hash      string
	ExpiresAt time.Time
}

func NewEmailVerificationService(userRepo *repository.UserRepository, cfg config.EmailConfig, kafkaCfg config.KafkaConfig, redisClient *redis.RedisClient) *EmailVerificationService {
	size := cfg.QueueSize
	if size <= 0 {
		size = 100
	}

	service := &EmailVerificationService{
		userRepo:  userRepo,
		cfg:       cfg,
		kafkaCfg:  kafkaCfg,
		redis:     redisClient,
		queue:     make(chan emailJob, size),
		codes:     make(map[string]memoryEmailCode),
		cooldowns: make(map[string]time.Time),
	}

	service.initRedpandaQueue()
	go service.runWorker()
	return service
}

func (s *EmailVerificationService) RequestRegistrationCode(email string) error {
	normalizedEmail, err := normalizeVerificationEmail(email)
	if err != nil {
		return err
	}

	if s.userRepo != nil {
		existingUser, err := s.userRepo.FindByEmail(normalizedEmail)
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if existingUser != nil && existingUser.ID != 0 {
			return errors.New("email already exists")
		}
	}

	return s.requestCode(normalizedEmail, emailVerificationPurposeRegister)
}

func (s *EmailVerificationService) RequestPasswordResetCode(email string) error {
	normalizedEmail, err := normalizeVerificationEmail(email)
	if err != nil {
		return err
	}

	if s.userRepo != nil {
		existingUser, err := s.userRepo.FindByEmail(normalizedEmail)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("email not found")
			}
			return err
		}
		if existingUser == nil || existingUser.ID == 0 {
			return errors.New("email not found")
		}
	}

	return s.requestCode(normalizedEmail, emailVerificationPurposeResetPassword)
}

func (s *EmailVerificationService) requestCode(normalizedEmail, purpose string) error {
	cooldown := time.Duration(s.cfg.CodeCooldownSeconds) * time.Second
	if cooldown <= 0 {
		cooldown = time.Minute
	}
	if ok, err := s.reserveCooldown(normalizedEmail, purpose, cooldown); err != nil {
		return err
	} else if !ok {
		return errors.New("please wait before requesting another code")
	}

	code, err := generateEmailCode()
	if err != nil {
		s.clearCooldown(normalizedEmail, purpose)
		return err
	}

	ttl := time.Duration(s.cfg.CodeTTLMinutes) * time.Minute
	if ttl <= 0 {
		ttl = 10 * time.Minute
	}
	expiresAt := time.Now().Add(ttl)

	if err := s.storePurposeCode(normalizedEmail, purpose, hashEmailCode(normalizedEmail, code), ttl, expiresAt); err != nil {
		s.clearCooldown(normalizedEmail, purpose)
		return err
	}

	s.enqueueSend(emailJob{Email: normalizedEmail, Code: code, Purpose: purpose, ExpiresAt: expiresAt})
	return nil
}

func (s *EmailVerificationService) VerifyRegistrationCode(email, code string) error {
	return s.verifyCode(email, code, emailVerificationPurposeRegister)
}

func (s *EmailVerificationService) VerifyPasswordResetCode(email, code string) error {
	return s.verifyCode(email, code, emailVerificationPurposeResetPassword)
}

func (s *EmailVerificationService) verifyCode(email, code, purpose string) error {
	normalizedEmail, err := normalizeVerificationEmail(email)
	if err != nil {
		return err
	}

	normalizedCode := strings.TrimSpace(code)
	if len(normalizedCode) != 6 {
		return errors.New("invalid verification code")
	}

	expectedHash, err := s.getStoredHash(normalizedEmail, purpose)
	if err != nil || expectedHash == "" {
		return errors.New("verification code expired or not found")
	}

	actualHash := hashEmailCode(normalizedEmail, normalizedCode)
	if subtle.ConstantTimeCompare([]byte(expectedHash), []byte(actualHash)) != 1 {
		return errors.New("invalid verification code")
	}

	return nil
}

func (s *EmailVerificationService) ConsumeRegistrationCode(email string) {
	s.consumeCode(email, emailVerificationPurposeRegister)
}

func (s *EmailVerificationService) ConsumePasswordResetCode(email string) {
	s.consumeCode(email, emailVerificationPurposeResetPassword)
}

func (s *EmailVerificationService) consumeCode(email, purpose string) {
	normalizedEmail, err := normalizeVerificationEmail(email)
	if err != nil {
		return
	}

	key := s.codeKey(normalizedEmail, purpose)
	if s.redis != nil {
		_ = s.redis.Delete(key)
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.codes, key)
}

func (s *EmailVerificationService) runWorker() {
	for job := range s.queue {
		s.send(job)
	}
}

func (s *EmailVerificationService) initRedpandaQueue() {
	if !s.kafkaCfg.Enabled || len(s.kafkaCfg.Brokers) == 0 || s.kafkaCfg.TopicEmails == "" {
		return
	}

	groupID := s.kafkaCfg.ConsumerGroup
	switch {
	case groupID == "":
		groupID = "chat-backend-email"
	case strings.HasPrefix(groupID, "chat-backend-ws-"):
		groupID = "chat-backend-email"
	case !strings.HasSuffix(groupID, "-email"):
		groupID += "-email"
	}

	s.writer = kafka.NewWriter(kafka.WriterConfig{
		Brokers:      s.kafkaCfg.Brokers,
		Topic:        s.kafkaCfg.TopicEmails,
		Balancer:     &kafka.Hash{},
		RequiredAcks: int(kafka.RequireOne),
		Async:        false,
	})
	s.reader = kafka.NewReader(kafka.ReaderConfig{
		Brokers:     s.kafkaCfg.Brokers,
		Topic:       s.kafkaCfg.TopicEmails,
		GroupID:     groupID,
		StartOffset: kafka.LastOffset,
		MinBytes:    1,
		MaxBytes:    10e6,
	})

	logger.Info("Email verification queue enabled: brokers=%v topic=%s group=%s", s.kafkaCfg.Brokers, s.kafkaCfg.TopicEmails, groupID)
	go s.runRedpandaWorker(context.Background())
}

func (s *EmailVerificationService) enqueueSend(job emailJob) {
	if s.writer != nil {
		payload, err := json.Marshal(job)
		if err == nil {
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			err = s.writer.WriteMessages(ctx, kafka.Message{
				Key:   []byte(job.Email),
				Value: payload,
				Time:  time.Now().UTC(),
			})
			cancel()
		}
		if err == nil {
			return
		}
		logger.Warn("Email queue publish failed, falling back to local queue: %v", err)
	}

	select {
	case s.queue <- job:
	default:
		go s.send(job)
	}
}

func (s *EmailVerificationService) runRedpandaWorker(ctx context.Context) {
	if s.reader == nil {
		return
	}

	for {
		message, err := s.reader.FetchMessage(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			logger.Warn("Email queue fetch failed: %v", err)
			time.Sleep(2 * time.Second)
			continue
		}

		var job emailJob
		if err := json.Unmarshal(message.Value, &job); err != nil {
			logger.Warn("Email queue payload invalid: %v", err)
			_ = s.reader.CommitMessages(ctx, message)
			continue
		}

		s.send(job)
		if err := s.reader.CommitMessages(ctx, message); err != nil {
			logger.Warn("Email queue commit failed: %v", err)
		}
	}
}

func (s *EmailVerificationService) send(job emailJob) {
	if !job.ExpiresAt.IsZero() && time.Now().After(job.ExpiresAt) {
		log.Printf("skipping expired email verification code for %s, expired at %s", job.Email, job.ExpiresAt.Format(time.RFC3339))
		return
	}

	if s.cfg.SMTPHost == "" {
		log.Printf("email verification code for %s: %s, expires at %s", job.Email, job.Code, job.ExpiresAt.Format(time.RFC3339))
		return
	}

	if err := s.sendSMTP(job); err != nil {
		log.Printf("failed to send email verification code to %s: %v", job.Email, err)
		return
	}
	log.Printf("email verification code sent to %s", job.Email)
}

func (s *EmailVerificationService) sendSMTP(job emailJob) error {
	addr := fmt.Sprintf("%s:%d", s.cfg.SMTPHost, s.cfg.SMTPPort)
	from := mail.Address{Name: s.cfg.SMTPFromName, Address: s.cfg.SMTPFrom}
	to := mail.Address{Address: job.Email}
	subject := "Your Chatting verification code"
	if job.Purpose == emailVerificationPurposeResetPassword {
		subject = "Reset your Chatting password"
	}
	body := fmt.Sprintf("Your verification code is %s.\n\nIt expires at %s.\n", job.Code, job.ExpiresAt.Format("2006-01-02 15:04:05 MST"))
	if job.Purpose == emailVerificationPurposeResetPassword {
		body = fmt.Sprintf("Use this code to reset your Chatting password: %s.\n\nIt expires at %s.\n", job.Code, job.ExpiresAt.Format("2006-01-02 15:04:05 MST"))
	}
	message := strings.Join([]string{
		fmt.Sprintf("From: %s", from.String()),
		fmt.Sprintf("To: %s", to.String()),
		fmt.Sprintf("Subject: %s", subject),
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"",
		body,
	}, "\r\n")

	var auth smtp.Auth
	if s.cfg.SMTPUsername != "" {
		auth = smtp.PlainAuth("", s.cfg.SMTPUsername, s.cfg.SMTPPassword, s.cfg.SMTPHost)
	}

	if s.cfg.SMTPUseTLS {
		return sendMailWithImplicitTLS(addr, s.cfg.SMTPHost, auth, s.cfg.SMTPFrom, []string{job.Email}, []byte(message))
	}

	return sendMailWithStartTLS(addr, s.cfg.SMTPHost, auth, s.cfg.SMTPFrom, []string{job.Email}, []byte(message))
}

func sendMailWithStartTLS(addr, host string, auth smtp.Auth, from string, to []string, msg []byte) error {
	client, err := smtp.Dial(addr)
	if err != nil {
		return err
	}
	defer client.Close()

	if ok, _ := client.Extension("STARTTLS"); ok {
		if err := client.StartTLS(&tls.Config{ServerName: host, MinVersion: tls.VersionTLS12}); err != nil {
			return err
		}
	}

	if auth != nil {
		if ok, _ := client.Extension("AUTH"); ok {
			if err := client.Auth(auth); err != nil {
				return err
			}
		}
	}
	if err := client.Mail(from); err != nil {
		return err
	}
	for _, recipient := range to {
		if err := client.Rcpt(recipient); err != nil {
			return err
		}
	}
	writer, err := client.Data()
	if err != nil {
		return err
	}
	if _, err := writer.Write(msg); err != nil {
		return err
	}
	if err := writer.Close(); err != nil {
		return err
	}
	return client.Quit()
}

func sendMailWithImplicitTLS(addr, host string, auth smtp.Auth, from string, to []string, msg []byte) error {
	conn, err := tls.DialWithDialer(&net.Dialer{Timeout: 10 * time.Second}, "tcp", addr, &tls.Config{
		ServerName: host,
		MinVersion: tls.VersionTLS12,
	})
	if err != nil {
		return err
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, host)
	if err != nil {
		return err
	}
	defer client.Quit()

	if auth != nil {
		if ok, _ := client.Extension("AUTH"); ok {
			if err := client.Auth(auth); err != nil {
				return err
			}
		}
	}
	if err := client.Mail(from); err != nil {
		return err
	}
	for _, recipient := range to {
		if err := client.Rcpt(recipient); err != nil {
			return err
		}
	}
	writer, err := client.Data()
	if err != nil {
		return err
	}
	if _, err := writer.Write(msg); err != nil {
		return err
	}
	return writer.Close()
}

func (s *EmailVerificationService) reserveCooldown(email, purpose string, ttl time.Duration) (bool, error) {
	key := s.cooldownKey(email, purpose)
	if s.redis != nil {
		return s.redis.SetNX(key, "1", ttl)
	}

	now := time.Now()
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cleanupExpiredLocked(now)
	if expiresAt, ok := s.cooldowns[key]; ok && expiresAt.After(now) {
		return false, nil
	}
	s.cooldowns[key] = now.Add(ttl)
	return true, nil
}

func (s *EmailVerificationService) clearCooldown(email, purpose string) {
	key := s.cooldownKey(email, purpose)
	if s.redis != nil {
		_ = s.redis.Delete(key)
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.cooldowns, key)
}

func (s *EmailVerificationService) storeCode(email, hash string, ttl time.Duration, expiresAt time.Time) error {
	return s.storePurposeCode(email, emailVerificationPurposeRegister, hash, ttl, expiresAt)
}

func (s *EmailVerificationService) storePurposeCode(email, purpose, hash string, ttl time.Duration, expiresAt time.Time) error {
	key := s.codeKey(email, purpose)
	if s.redis != nil {
		return s.redis.Set(key, hash, ttl)
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.codes[key] = memoryEmailCode{Hash: hash, ExpiresAt: expiresAt}
	return nil
}

func (s *EmailVerificationService) getStoredHash(email, purpose string) (string, error) {
	key := s.codeKey(email, purpose)
	if s.redis != nil {
		return s.redis.Get(key)
	}

	now := time.Now()
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cleanupExpiredLocked(now)
	stored, ok := s.codes[key]
	if !ok || !stored.ExpiresAt.After(now) {
		return "", errors.New("verification code not found")
	}
	return stored.Hash, nil
}

func (s *EmailVerificationService) cleanupExpiredLocked(now time.Time) {
	for key, code := range s.codes {
		if !code.ExpiresAt.After(now) {
			delete(s.codes, key)
		}
	}
	for key, expiresAt := range s.cooldowns {
		if !expiresAt.After(now) {
			delete(s.cooldowns, key)
		}
	}
}

func (s *EmailVerificationService) codeKey(email, purpose string) string {
	return fmt.Sprintf("email:verification:%s:%s", purpose, email)
}

func (s *EmailVerificationService) cooldownKey(email, purpose string) string {
	return fmt.Sprintf("email:verification:%s:%s:cooldown", purpose, email)
}

func normalizeVerificationEmail(email string) (string, error) {
	trimmed := strings.TrimSpace(email)
	if trimmed == "" {
		return "", errors.New("email is required")
	}
	addr, err := mail.ParseAddress(trimmed)
	if err != nil || addr.Address != trimmed {
		return "", errors.New("invalid email")
	}
	return strings.ToLower(trimmed), nil
}

func generateEmailCode() (string, error) {
	value, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", value.Int64()), nil
}

func hashEmailCode(email, code string) string {
	sum := sha256.Sum256([]byte(email + ":" + code))
	return hex.EncodeToString(sum[:])
}
