#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing dependency: $cmd"
    exit 1
  fi
}

check_node_version() {
  local min_version="18.0.0"
  local node_version
  node_version="$(node -v | cut -d'v' -f2)"
  if [ "$(printf '%s\n' "$min_version" "$node_version" | sort -V | head -n1)" != "$min_version" ]; then
    echo "Node.js version is too low ($node_version). Need $min_version or higher."
    exit 1
  fi
}

echo "Checking dependencies..."
require_cmd node
require_cmd npm
require_cmd docker
check_node_version

if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo "Docker Compose is not available. Install Docker Compose and try again."
  exit 1
fi

if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo "Created .env from .env.example"
  else
    echo "Missing .env and .env.example. Aborting."
    exit 1
  fi
fi

set -a
source ./.env
set +a

echo "Installing dependencies..."
npm install

echo "Starting database..."
$COMPOSE up -d postgres

DB_USER="${POSTGRES_USER:-uxmail}"
DB_NAME="${POSTGRES_DB:-uxmail_db}"

echo "Waiting for database to be ready..."
for _ in {1..30}; do
  if docker exec uxmail_postgres pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! docker exec uxmail_postgres pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
  echo "Database is not ready. Check docker logs for uxmail_postgres."
  exit 1
fi

echo "Syncing database schema..."
if [ -x ./node_modules/.bin/prisma ]; then
  ./node_modules/.bin/prisma db push
else
  npx -y prisma@5.15.0 db push
fi

echo "Starting background sync worker..."
if [ -x ./node_modules/.bin/ts-node ]; then
  ./node_modules/.bin/ts-node scripts/sync-worker.ts &
  WORKER_PID=$!
else
  npx -y ts-node scripts/sync-worker.ts &
  WORKER_PID=$!
fi
trap 'kill $WORKER_PID 2>/dev/null' EXIT

echo "Starting app server (frontend + backend)..."
npm run dev
