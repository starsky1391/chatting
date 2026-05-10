package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Response struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Message string      `json:"message,omitempty"`
	Error   string      `json:"error,omitempty"`
}

func Success(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{
		Success: true,
		Data:    data,
	})
}

func SuccessWithMessage(c *gin.Context, data interface{}, message string) {
	c.JSON(http.StatusOK, Response{
		Success: true,
		Data:    data,
		Message: message,
	})
}

func Created(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, Response{
		Success: true,
		Data:    data,
	})
}

func BadRequest(c *gin.Context, message string) {
	c.JSON(http.StatusBadRequest, Response{
		Success: false,
		Error:   message,
	})
}

func Unauthorized(c *gin.Context, message string) {
	c.JSON(http.StatusUnauthorized, Response{
		Success: false,
		Error:   message,
	})
}

func Forbidden(c *gin.Context, message string) {
	c.JSON(http.StatusForbidden, Response{
		Success: false,
		Error:   message,
	})
}

func NotFound(c *gin.Context, message string) {
	c.JSON(http.StatusNotFound, Response{
		Success: false,
		Error:   message,
	})
}

func InternalError(c *gin.Context, message string) {
	c.JSON(http.StatusInternalServerError, Response{
		Success: false,
		Error:   message,
	})
}

func Error(c *gin.Context, statusCode int, message string) {
	c.JSON(statusCode, Response{
		Success: false,
		Error:   message,
	})
}