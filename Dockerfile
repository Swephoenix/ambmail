# Build stage
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma

RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source and build
COPY . .
RUN npm run build

# Production stage
FROM node:20-bookworm-slim AS production

WORKDIR /app

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1001 appuser

# Copy package files and install production deps only
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
RUN npm ci --omit=dev && npm cache clean --force

# Generate Prisma client for production
RUN npx prisma generate --config prisma.config.ts

# Copy built artifacts from builder
COPY --from=builder --chown=appuser:appuser /app/.next ./.next
COPY --from=builder --chown=appuser:appuser /app/public ./public
COPY --from=builder --chown=appuser:appuser /app/scripts ./scripts

# Copy entrypoint
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER appuser

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "run", "start"]
