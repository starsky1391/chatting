package middleware

import (
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"chat-backend/internal/config"
	"chat-backend/pkg/response"
)

type Claims struct {
	UserID    uint   `json:"userId"`
	Username  string `json:"username"`
	AvatarUrl string `json:"avatarUrl"`
	jwt.RegisteredClaims
}

func AuthMiddleware(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// CORS headers
		origin := c.GetHeader("Origin")
		if origin == "" {
			origin = "*"
		}

		// Check if origin is allowed
		allowed := false
		for _, o := range cfg.AllowedOrigins {
			if strings.Contains(origin, o) {
				allowed = true
				break
			}
		}

		if allowed || origin == "*" {
			c.Header("Access-Control-Allow-Origin", origin)
		}

		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		// Get token from Authorization header or query parameter (for WebSocket)
		var tokenString string
		authHeader := c.GetHeader("Authorization")

		if authHeader != "" {
			tokenString = strings.TrimPrefix(authHeader, "Bearer ")
			if tokenString == authHeader {
				response.Unauthorized(c, "Invalid authorization format")
				c.Abort()
				return
			}
		} else {
			// Try to get token from query parameter (for WebSocket connections)
			tokenString = c.Query("token")
			if tokenString == "" {
				response.Unauthorized(c, "No authorization header or token")
				c.Abort()
				return
			}
		}

		// Parse and validate token
		token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
			return []byte(cfg.JWT.Secret), nil
		})

		if err != nil || !token.Valid {
			response.Unauthorized(c, "Invalid token")
			c.Abort()
			return
		}

		claims, ok := token.Claims.(*Claims)
		if !ok {
			response.Unauthorized(c, "Invalid token claims")
			c.Abort()
			return
		}

		// Store claims in context
		c.Set("userID", claims.UserID)
		c.Set("username", claims.Username)
		c.Next()
	}
}

func CORSMiddleware(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")

		// Allow requests with no origin (like mobile apps)
		if origin == "" {
			c.Next()
			return
		}

		// Check if origin is allowed
		allowed := false
		for _, o := range cfg.AllowedOrigins {
			if strings.Contains(origin, o) {
				allowed = true
				break
			}
		}

		if allowed {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Access-Control-Allow-Credentials", "true")
			c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie")

			if c.Request.Method == "OPTIONS" {
				c.AbortWithStatus(204)
				return
			}
		}

		c.Next()
	}
}

func GenerateToken(userID uint, username string, cfg *config.Config) (string, error) {
	claims := Claims{
		UserID:   userID,
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(cfg.JWT.ExpiresIn) * time.Second)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(cfg.JWT.Secret))
}