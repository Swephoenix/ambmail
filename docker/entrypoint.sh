#!/usr/bin/env sh
set -eu

# Ensure Prisma client is up to date in the container runtime environment.
npx prisma generate >/dev/null 2>&1 || true

# Apply DB migrations before starting app/worker.
npx prisma migrate deploy

exec "$@"
