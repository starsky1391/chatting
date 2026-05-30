package config

import (
	"os"
	"strconv"
	"strings"

	"github.com/spf13/viper"
)

type Config struct {
	Port           string
	Database       DatabaseConfig
	JWT            JWTConfig
	Redis          RedisConfig
	RabbitMQ       RabbitMQConfig
	Kafka          KafkaConfig
	Admin          AdminConfig
	LogLevel       string
	AllowedOrigins []string
	Wechat         WechatConfig
	AI             AIConfig
}

type WechatConfig struct {
	AppID     string
	AppSecret string
}

type AIConfig struct {
	APIURL string
	APIKey string
	Model  string
}

type DatabaseConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	DBName   string
	URL      string
}

type JWTConfig struct {
	Secret    string
	ExpiresIn int
}

type RedisConfig struct {
	Host     string
	Port     int
	Password string
	DB       int
}

type RabbitMQConfig struct {
	Host     string
	Port     int
	User     string
	Password string
}

type KafkaConfig struct {
	Enabled       bool
	Brokers       []string
	TopicEvents   string
	ConsumerGroup string
}

type AdminConfig struct {
	Email    string
	Username string
	Password string
}

func Load() (*Config, error) {
	viper.SetConfigFile(".env")
	viper.AutomaticEnv()

	// Set defaults
	viper.SetDefault("PORT", "3001")
	viper.SetDefault("LOG_LEVEL", "info")
	viper.SetDefault("KAFKA_TOPIC_EVENTS", "chat.events")

	// Try to read config file, ignore error if not found
	_ = viper.ReadInConfig()

	cfg := &Config{
		Port:           viper.GetString("PORT"),
		LogLevel:       viper.GetString("LOG_LEVEL"),
		AllowedOrigins: []string{"localhost", ".vercel.app", ".railway.app"},
	}

	// Database config
	dbURL := viper.GetString("DATABASE_URL")
	if dbURL != "" {
		cfg.Database.URL = dbURL
	} else {
		cfg.Database.Host = viper.GetString("DB_HOST")
		cfg.Database.Port = viper.GetInt("DB_PORT")
		cfg.Database.User = viper.GetString("DB_USER")
		cfg.Database.Password = viper.GetString("DB_PASSWORD")
		cfg.Database.DBName = viper.GetString("DB_NAME")
	}

	// JWT config
	cfg.JWT.Secret = viper.GetString("JWT_SECRET")
	if cfg.JWT.Secret == "" {
		cfg.JWT.Secret = "default-secret-change-in-production"
	}
	cfg.JWT.ExpiresIn = viper.GetInt("JWT_EXPIRES_IN")
	if cfg.JWT.ExpiresIn == 0 {
		cfg.JWT.ExpiresIn = 86400 // 24 hours
	}

	// Redis config
	cfg.Redis.Host = viper.GetString("REDIS_HOST")
	cfg.Redis.Port = viper.GetInt("REDIS_PORT")
	cfg.Redis.Password = viper.GetString("REDIS_PASSWORD")
	cfg.Redis.DB = viper.GetInt("REDIS_DB")

	// RabbitMQ config
	cfg.RabbitMQ.Host = viper.GetString("RABBITMQ_HOST")
	cfg.RabbitMQ.Port = viper.GetInt("RABBITMQ_PORT")
	cfg.RabbitMQ.User = viper.GetString("RABBITMQ_USER")
	cfg.RabbitMQ.Password = viper.GetString("RABBITMQ_PASSWORD")

	// Kafka config. Leave KAFKA_BROKERS empty to disable event publishing locally.
	kafkaBrokers := splitCSV(viper.GetString("KAFKA_BROKERS"))
	cfg.Kafka.Brokers = kafkaBrokers
	cfg.Kafka.TopicEvents = viper.GetString("KAFKA_TOPIC_EVENTS")
	cfg.Kafka.ConsumerGroup = viper.GetString("KAFKA_CONSUMER_GROUP")
	if cfg.Kafka.ConsumerGroup == "" {
		hostname, _ := os.Hostname()
		if hostname == "" {
			hostname = "local"
		}
		cfg.Kafka.ConsumerGroup = "chat-backend-ws-" + hostname
	}
	cfg.Kafka.Enabled = len(kafkaBrokers) > 0

	// Admin bootstrap account
	cfg.Admin.Email = viper.GetString("ADMIN_EMAIL")
	if cfg.Admin.Email == "" {
		cfg.Admin.Email = "admin@example.com"
	}
	cfg.Admin.Username = viper.GetString("ADMIN_USERNAME")
	if cfg.Admin.Username == "" {
		cfg.Admin.Username = "admin"
	}
	cfg.Admin.Password = viper.GetString("ADMIN_PASSWORD")
	if cfg.Admin.Password == "" {
		cfg.Admin.Password = "admin123456"
	}

	// Wechat config
	cfg.Wechat.AppID = viper.GetString("WECHAT_APP_ID")
	cfg.Wechat.AppSecret = viper.GetString("WECHAT_APP_SECRET")

	// AI config. AI_API_URL can point to any service that accepts a prompt and
	// returns OpenAI-style JSON or a simple answer/content/message field.
	cfg.AI.APIURL = viper.GetString("AI_API_URL")
	cfg.AI.APIKey = viper.GetString("AI_API_KEY")
	cfg.AI.Model = viper.GetString("AI_MODEL")

	return cfg, nil
}

func splitCSV(value string) []string {
	if value == "" {
		return nil
	}
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		item := strings.TrimSpace(part)
		if item != "" {
			result = append(result, item)
		}
	}
	return result
}

func getEnvAsInt(key string, defaultVal int) int {
	val := os.Getenv(key)
	if val == "" {
		return defaultVal
	}
	i, err := strconv.Atoi(val)
	if err != nil {
		return defaultVal
	}
	return i
}
