# ============================================
# Frontend Dockerfile with China Mirror
# Enhanced retry mechanism for unstable networks
# ============================================

ARG NPM_REGISTRY=https://registry.npmmirror.com
ARG NEXT_PUBLIC_API_URL=
ARG NEXT_PUBLIC_SOCKET_URL=
ARG NEXT_PUBLIC_IMAGE_URL=

# Dependencies stage
FROM node:20-alpine AS deps

ARG NPM_REGISTRY

# Use Alibaba mirror for Alpine
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# Install dependencies
RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY package.json package-lock.json* .npmrc ./

# Configure npm with enhanced retry settings
RUN npm config set registry ${NPM_REGISTRY} && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-factor 2 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-timeout 300000 && \
    npm config set maxsockets 10 && \
    # First attempt: use configured mirror
    npm install --prefer-offline --no-audit --no-fund --progress=false 2>&1 || \
    (echo "=== Mirror failed, trying official registry ===" && \
     npm config set registry https://registry.npmjs.org && \
     npm install --prefer-offline --no-audit --no-fund --progress=false) 2>&1 || \
    (echo "=== Official failed, trying again with longer timeout ===" && \
     npm config set fetch-timeout 600000 && \
     npm install --prefer-offline --no-audit --no-fund --progress=false)

# Builder stage
FROM node:20-alpine AS builder

ARG NPM_REGISTRY
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SOCKET_URL
ARG NEXT_PUBLIC_IMAGE_URL

# Use Alibaba mirror for Alpine
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_SOCKET_URL=${NEXT_PUBLIC_SOCKET_URL}
ENV NEXT_PUBLIC_IMAGE_URL=${NEXT_PUBLIC_IMAGE_URL}
ENV TURBOPACK_DISABLE_FS_BENCHMARKING=1

# Build with output standalone for smaller image
RUN npm run build 2>&1

# Runtime stage
FROM node:20-alpine AS runner

# Use Alibaba mirror for Alpine
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/public ./public

RUN mkdir .next && chown nextjs:nodejs .next

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000 || exit 1

CMD ["node", "server.js"]
