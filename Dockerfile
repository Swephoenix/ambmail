FROM node:20-bookworm-slim

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies first
COPY package*.json ./
COPY prisma ./prisma

RUN npm ci

# Generate Prisma client explicitly
RUN npx prisma generate

# Copy rest of source
COPY . .

# Build
RUN npm run build

# Runtime
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "run", "start"]
