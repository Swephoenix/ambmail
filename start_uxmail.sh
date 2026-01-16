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

echo "Resetting local state (database + secrets)..."
$COMPOSE down -v --remove-orphans >/dev/null 2>&1 || true
rm -f .uxmail.key .uxmail.secrets
if [ -f .env ]; then
  rm -f .env
  echo "Removed .env to regenerate secrets."
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

echo "Installing dependencies..."
npm install

TS_NODE="./node_modules/.bin/ts-node"
TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS"}'

echo "Bootstrapping secrets..."
"$TS_NODE" --compiler-options "$TS_NODE_COMPILER_OPTIONS" scripts/bootstrap-secrets.ts
if [ -f .uxmail.secrets ]; then
  echo "Generated secrets stored in .uxmail.secrets"
fi

set -a
source ./.env
set +a

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
  ./node_modules/.bin/prisma db push --accept-data-loss
else
  npx -y prisma@5.15.0 db push --accept-data-loss
fi

echo "Ensuring admin user..."
"$TS_NODE" --compiler-options "$TS_NODE_COMPILER_OPTIONS" scripts/create-admin.ts

echo "Starting background sync worker..."
"$TS_NODE" --compiler-options "$TS_NODE_COMPILER_OPTIONS" scripts/sync-worker.ts &
WORKER_PID=$!
trap 'kill $WORKER_PID 2>/dev/null' EXIT

echo "Starting app server (frontend + backend)..."
ADMIN_PANEL_PORT="3000"
PORT_CHECK_PID=""
if command -v lsof >/dev/null 2>&1; then
  (
    while [ -d /proc/$PPID ]; do
      if lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null | awk '$1=="node" && $9 ~ /:3000$/ {found=1} END {exit !found}'; then
        ADMIN_PANEL_PORT="3000"
        break
      fi
      if lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null | awk '$1=="node" && $9 ~ /:3001$/ {found=1} END {exit !found}'; then
        ADMIN_PANEL_PORT="3001"
        break
      fi
      if lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null | awk '$1=="node" && $9 ~ /:3002$/ {found=1} END {exit !found}'; then
        ADMIN_PANEL_PORT="3002"
        break
      fi
      if lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null | awk '$1=="node" && $9 ~ /:3003$/ {found=1} END {exit !found}'; then
        ADMIN_PANEL_PORT="3003"
        break
      fi
      if lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null | awk '$1=="node" && $9 ~ /:3004$/ {found=1} END {exit !found}'; then
        ADMIN_PANEL_PORT="3004"
        break
      fi
      sleep 0.2
    done
    if [ -n "$ADMIN_PANEL_PORT" ]; then
      echo "Admin panel: http://localhost:${ADMIN_PANEL_PORT}/admin"
    fi
  ) &
  PORT_CHECK_PID=$!
fi
if [ -f .next/dev/lock ]; then
  if ps aux | grep -q "[n]ext dev"; then
    echo "Another Next.js dev server is already running. Stop it before restarting."
    exit 1
  fi
  echo "Removing stale Next.js dev lock..."
  rm -f .next/dev/lock
fi
npm run dev
