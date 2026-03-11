FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies and build
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production Stage
FROM node:20-alpine
WORKDIR /app

# Create a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled frontend and backend
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts

# Install tsx globally or locally to run the server.ts
# Since it's a TS file, we need tsx or transpile it, but let's use the local dependency if it's there
RUN npm install tsx -g

# Prepare database directory for SQLite
RUN mkdir -p /app/data && chown -R appuser:appgroup /app

USER appuser

# Expose API PORT
EXPOSE 3000

ENV NODE_ENV=production

# SQLite path override (to keep data persistent)
ENV DB_PATH=/app/data/app.db

CMD ["tsx", "server.ts"]
