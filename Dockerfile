FROM node:20-bookworm-slim

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security (use unique UID to avoid conflicts)
RUN useradd -m -u 1001 appuser

# Install dependencies first
COPY package*.json ./
COPY prisma ./prisma

RUN npm install

# Generate Prisma client explicitly
RUN npx prisma generate

# Copy rest of source
COPY . .

# Build
RUN npm run build

# Set ownership for app user
RUN chown -R appuser:appuser /app

# Runtime
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER appuser

ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "run", "start"]
