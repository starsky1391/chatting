FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

FROM node:20-alpine AS runner

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

RUN mkdir -p /app/uploads/images && chown -R appuser:nodejs /app/uploads

USER appuser

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3001/health || exit 1

CMD ["node", "dist/index.js"]
