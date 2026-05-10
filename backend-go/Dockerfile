# ============================================
# Go Backend Dockerfile with China Mirror
# Enhanced retry mechanism for unstable networks
# ============================================

# Build stage
FROM golang:1.23-alpine AS builder

# Use Alibaba mirror for Alpine
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

WORKDIR /app

# Set Go proxy for China (with fallback)
ENV GOPROXY=https://goproxy.cn,https://goproxy.io,direct
ENV GOSUMDB=off

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies with retry
RUN for i in 1 2 3; do \
        echo "=== Attempt $i: Downloading Go modules ===" && \
        go mod download && break || \
        echo "Download failed, retrying in 5s..." && sleep 5; \
    done || \
    (echo "=== Trying with GOPROXY direct ===" && \
     GOPROXY=https://proxy.golang.org,direct go mod download)

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o main ./cmd/server

# Runtime stage
FROM alpine:latest

# Use Alibaba mirror for Alpine
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# Install ca-certificates for HTTPS and tzdata for timezone, curl for health check
RUN apk --no-cache add ca-certificates tzdata curl

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/main .

# Set timezone
ENV TZ=Asia/Shanghai

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://127.0.0.1:3001/health || exit 1

CMD ["./main"]
