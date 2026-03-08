#!/usr/bin/env sh
set -eu

# Ensure Prisma client is up to date in the container runtime environment.
npx prisma generate >/dev/null 2>&1 || true

# Apply DB migrations if they exist, otherwise use db push.
# Check if migrations directory exists and has migration folders.
if [ -d "prisma/migrations" ] && [ "$(find prisma/migrations -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)" -gt 0 ]; then
  npx prisma migrate deploy || npx prisma db push --accept-data-loss
else
  npx prisma db push --accept-data-loss
fi

exec "$@"
