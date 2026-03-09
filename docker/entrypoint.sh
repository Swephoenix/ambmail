#!/usr/bin/env sh
set -eu

# Prisma 7 uses prisma.config.ts for database configuration
# The DATABASE_URL environment variable is read by prisma.config.ts

# Check if DATABASE_URL is set
if [ -z "${DATABASE_URL:-}" ]; then
  echo "Warning: DATABASE_URL not set, skipping database operations"
  exec "$@"
fi

# Apply DB migrations if they exist, otherwise use db push.
if [ -d "prisma/migrations" ] && [ "$(find prisma/migrations -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)" -gt 0 ]; then
  npx prisma migrate deploy --config prisma.config.ts || npx prisma db push --accept-data-loss --config prisma.config.ts
else
  npx prisma db push --accept-data-loss --config prisma.config.ts
fi

exec "$@"
