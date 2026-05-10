package config

import (
	"os"
	"strconv"

	"github.com/spf13/viper"
)

type Config struct {
	Port        string
	Database    DatabaseConfig
	JWT         JWTConfig
	Redis       RedisConfig
	RabbitMQ    RabbitMQConfig
	LogLevel    string
	AllowedOrigins []string
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
	Secret     string
	ExpiresIn  int
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

func Load() (*Config, error) {
	viper.SetConfigFile(".env")
	viper.AutomaticEnv()

	// Set defaults
	viper.SetDefault("PORT", "3001")
	viper.SetDefault("LOG_LEVEL", "info")

	// Try to read config file, ignore error if not found
	_ = viper.ReadInConfig()

	cfg := &Config{
		Port:        viper.GetString("PORT"),
		LogLevel:    viper.GetString("LOG_LEVEL"),
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

	return cfg, nil
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