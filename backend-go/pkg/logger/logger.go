package logger

import (
	"fmt"
	"os"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var log *zap.SugaredLogger

func Init(level string) {
	var config zap.Config

	if level == "debug" {
		config = zap.NewDevelopmentConfig()
	} else {
		config = zap.NewProductionConfig()
	}

	config.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
	config.OutputPaths = []string{"stdout"}
	config.ErrorOutputPaths = []string{"stderr"}

	logger, err := config.Build()
	if err != nil {
		fmt.Printf("Failed to initialize logger: %v\n", err)
		os.Exit(1)
	}

	log = logger.Sugar()
}

func Debug(msg string, args ...interface{}) {
	if log != nil {
		log.Debugf(msg, args...)
	}
}

func Info(msg string, args ...interface{}) {
	if log != nil {
		log.Infof(msg, args...)
	}
}

func Warn(msg string, args ...interface{}) {
	if log != nil {
		log.Warnf(msg, args...)
	}
}

func Error(msg string, args ...interface{}) {
	if log != nil {
		log.Errorf(msg, args...)
	}
}

func Fatal(msg string, args ...interface{}) {
	if log != nil {
		log.Fatalf(msg, args...)
	}
}