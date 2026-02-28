FROM node:22-bookworm-slim

WORKDIR /app

# Install dependencies first for better layer caching
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Runtime defaults
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "run", "start"]
