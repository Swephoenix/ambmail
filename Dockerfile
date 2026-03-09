# Build stage
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies first (better caching)
COPY package*.json ./
COPY prisma ./prisma

RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Copy source and build
COPY . .
RUN npm run build

# Production stage - app
FROM node:20-bookworm-slim AS app

WORKDIR /app

# Install runtime dependencies only
RUN apt-get update && apt-get install -y \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1001 appuser

# Copy only necessary files from builder
COPY --from=builder --chown=appuser:appuser /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appuser /app/prisma ./prisma
COPY --from=builder --chown=appuser:appuser /app/.next ./.next
COPY --from=builder --chown=appuser:appuser /app/public ./public
COPY --from=builder --chown=appuser:appuser /app/package*.json ./
COPY --from=builder --chown=appuser:appuser /app/scripts ./scripts
COPY --from=builder --chown=appuser:appuser /app/src ./src
COPY --from=builder --chown=appuser:appuser /app/*.ts ./
COPY --from=builder --chown=appuser:appuser /app/tsconfig.json ./

# Copy entrypoint
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

USER appuser

ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "run", "start"]

# Worker stage - same as app but different command
FROM app AS worker

# Override entrypoint for worker - run ts-node directly
ENTRYPOINT []
CMD ["npx", "ts-node", "--compiler-options", "{\"module\":\"CommonJS\"}", "scripts/sync-worker.ts"]
