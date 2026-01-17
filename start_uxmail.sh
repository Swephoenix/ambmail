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
check_node_version

RESET_STATE="${UXMAIL_RESET:-1}"
if [ "$RESET_STATE" = "1" ] || [ "$RESET_STATE" = "true" ]; then
  echo "WARNING: This will wipe the database and regenerate secrets."
  echo "Resetting local state (database + secrets)..."
  rm -f .uxmail.key .uxmail.secrets
  if [ -f .env ]; then
    rm -f .env
    echo "Removed .env to regenerate secrets."
  fi
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
RESET_DB_DONE="0"

echo "Bootstrapping secrets..."
"$TS_NODE" --compiler-options "$TS_NODE_COMPILER_OPTIONS" scripts/bootstrap-secrets.ts
if [ -f .uxmail.secrets ]; then
  echo "Generated secrets stored in .uxmail.secrets"
fi

set -a
source ./.env
set +a

START_POSTGRES="${UXMAIL_START_POSTGRES:-1}"
SETUP_DB="${UXMAIL_SETUP_DB:-1}"
if [ "$START_POSTGRES" = "1" ] || [ "$START_POSTGRES" = "true" ]; then
  if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl start postgresql
  elif command -v brew >/dev/null 2>&1; then
    brew services start postgresql
  elif command -v pg_ctl >/dev/null 2>&1; then
    PGDATA="${PGDATA:-}"
    if [ -z "$PGDATA" ]; then
      echo "PGDATA is not set; cannot start PostgreSQL with pg_ctl."
      echo "Set PGDATA or start PostgreSQL manually."
    else
      pg_ctl -D "$PGDATA" start
    fi
  else
    echo "Could not auto-start PostgreSQL. Start it manually."
  fi
else
  echo "Ensure your PostgreSQL is running."
fi
if [ "$SETUP_DB" = "1" ] || [ "$SETUP_DB" = "true" ]; then
  if [ -x ./scripts/setup_postgres_local.sh ]; then
    ./scripts/setup_postgres_local.sh
  else
    echo "Missing scripts/setup_postgres_local.sh. Cannot auto-setup DB."
    exit 1
  fi
fi

DB_USER="${POSTGRES_USER:-uxmail}"
DB_NAME="${POSTGRES_DB:-uxmail_db}"

if command -v pg_isready >/dev/null 2>&1; then
  DB_CHECK_INFO="$(node -e 'const u=new URL(process.env.DATABASE_URL); const db=u.pathname.startsWith("/") ? u.pathname.slice(1) : u.pathname; console.log(["host="+u.hostname,"port="+(u.port||5432),"user="+u.username,"password="+u.password,"db="+db].join("\n"))')"
  host=""
  port=""
  user=""
  password=""
  db=""
  while IFS='=' read -r key value; do
    case "$key" in
      host) host="$value" ;;
      port) port="$value" ;;
      user) user="$value" ;;
      password) password="$value" ;;
      db) db="$value" ;;
    esac
  done <<< "$DB_CHECK_INFO"
  if [ -n "$password" ]; then
    PGPASSWORD="$password" pg_isready -h "$host" -p "$port" -U "$user" -d "$db" >/dev/null 2>&1 || {
      echo "Database is not ready. Ensure PostgreSQL is running and DATABASE_URL is correct ($host:$port)."
      exit 1
    }
  else
    pg_isready -h "$host" -p "$port" -U "$user" -d "$db" >/dev/null 2>&1 || {
      echo "Database is not ready. Ensure PostgreSQL is running and DATABASE_URL is correct ($host:$port)."
      exit 1
    }
  fi
  if command -v psql >/dev/null 2>&1; then
    if [ -z "$db" ] || [ -z "$user" ] || [ -z "$host" ]; then
      echo "Database configuration is incomplete. Check DATABASE_URL."
      exit 1
    fi
    if [ -n "$password" ]; then
      PGPASSWORD="$password" psql -h "$host" -p "$port" -U "$user" -d "$db" -c 'select 1' >/dev/null 2>&1 || {
        echo "Cannot connect to database. Run scripts/setup_postgres_local.sh or create the role/db manually."
        exit 1
      }
    else
      psql -h "$host" -p "$port" -U "$user" -d "$db" -c 'select 1' >/dev/null 2>&1 || {
        echo "Cannot connect to database. Run scripts/setup_postgres_local.sh or create the role/db manually."
        exit 1
      }
    fi
  else
    echo "psql not found; skipping DB connectivity check."
  fi
else
  echo "pg_isready not found; skipping DB readiness check."
fi

echo "Syncing database schema..."
if [ "$RESET_STATE" = "1" ] || [ "$RESET_STATE" = "true" ]; then
  echo "Resetting database..."
  if [ -x ./node_modules/.bin/prisma ]; then
    ./node_modules/.bin/prisma db push --force-reset --accept-data-loss
  else
    npx -y prisma@5.15.0 db push --force-reset --accept-data-loss
  fi
  RESET_DB_DONE="1"
fi

if [ "$RESET_DB_DONE" = "0" ]; then
  if [ -x ./node_modules/.bin/prisma ]; then
    ./node_modules/.bin/prisma db push --accept-data-loss
  else
    npx -y prisma@5.15.0 db push --accept-data-loss
  fi
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
