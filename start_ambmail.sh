#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

AUTO_INSTALL="${AMBMAIL_AUTO_INSTALL:-0}"
STEP_NUM=0

log_step() {
  STEP_NUM=$((STEP_NUM + 1))
  echo ""
  echo "==> Step ${STEP_NUM}: $1"
}

have_cmd() {
  command -v "$1" >/dev/null 2>&1
}

install_packages() {
  local pkgs=("$@")
  if [ "${#pkgs[@]}" -eq 0 ]; then
    return 0
  fi
  if have_cmd apt-get; then
    echo "Installing packages via apt-get: ${pkgs[*]}"
    sudo apt-get update -y
    sudo apt-get install -y "${pkgs[@]}"
  elif have_cmd brew; then
    echo "Installing packages via brew: ${pkgs[*]}"
    brew install "${pkgs[@]}"
  else
    echo "No supported package manager found (apt-get or brew). Install missing dependencies manually."
    return 1
  fi
}

read_pkg_version() {
  local pkg="$1"
  node -e "const p=require('./package.json'); const v=(p.dependencies&&p.dependencies['$pkg'])||(p.devDependencies&&p.devDependencies['$pkg'])||''; console.log(v);" 2>/dev/null
}

version_major() {
  local raw="$1"
  raw="${raw#^}"
  raw="${raw#~}"
  raw="${raw#v}"
  raw="${raw%%-*}"
  raw="${raw%%+*}"
  printf '%s' "${raw%%.*}"
}

ensure_prisma_latest() {
  local update_flag="${AMBMAIL_PRISMA_UPDATE:-0}"
  if [ "$update_flag" != "1" ] && [ "$update_flag" != "true" ]; then
    return 0
  fi
  local prisma_ver client_ver prisma_major client_major
  prisma_ver="$(read_pkg_version prisma)"
  client_ver="$(read_pkg_version @prisma/client)"
  prisma_major="$(version_major "$prisma_ver")"
  client_major="$(version_major "$client_ver")"
  if [ -z "$prisma_major" ] || [ "$prisma_major" -lt 7 ] || [ -z "$client_major" ] || [ "$client_major" -lt 7 ]; then
    echo "Updating Prisma packages to latest..."
    npm i --save-dev prisma@latest
    npm i @prisma/client@latest
  fi
}

ensure_node_packages() {
  local pkgs=("$@")
  local missing=()
  local pkg
  for pkg in "${pkgs[@]}"; do
    if [ ! -d "node_modules/$pkg" ]; then
      missing+=("$pkg")
    fi
  done
  if [ "${#missing[@]}" -gt 0 ]; then
    echo "Installing missing npm packages: ${missing[*]}"
    npm install "${missing[@]}"
  fi
}

ensure_node_dev_packages() {
  local pkgs=("$@")
  local missing=()
  local pkg
  for pkg in "${pkgs[@]}"; do
    if [ ! -d "node_modules/$pkg" ]; then
      missing+=("$pkg")
    fi
  done
  if [ "${#missing[@]}" -gt 0 ]; then
    echo "Installing missing npm dev packages: ${missing[*]}"
    npm install --save-dev "${missing[@]}"
  fi
}

ensure_cmd() {
  local cmd="$1"
  shift
  local pkgs=("$@")
  if have_cmd "$cmd"; then
    return 0
  fi
  echo "Missing dependency: $cmd"
  if [ "$AUTO_INSTALL" = "1" ] || [ "$AUTO_INSTALL" = "true" ]; then
    install_packages "${pkgs[@]}" || {
      echo "Failed to install dependency for: $cmd"
      exit 1
    }
    if ! have_cmd "$cmd"; then
      echo "Dependency still missing after install attempt: $cmd"
      exit 1
    fi
  else
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

log_step "Checking dependencies"
ensure_cmd node nodejs
ensure_cmd npm nodejs npm
check_node_version

RESET_STATE="${AMBMAIL_RESET:-}"
if [ -z "$RESET_STATE" ] && [ -f .env ]; then
  RESET_STATE="$(sed -n 's/^AMBMAIL_RESET=//p' .env | head -n1 | tr -d '"')"
fi
RESET_STATE="${RESET_STATE:-1}"
if [ "$RESET_STATE" = "1" ] || [ "$RESET_STATE" = "true" ]; then
  log_step "Resetting local state"
  echo "WARNING: This will wipe the database and regenerate secrets."
  echo "Resetting local state (database + secrets)..."
  rm -f .ambmail.key .ambmail.secrets
  if [ -f .env ]; then
    rm -f .env
    echo "Removed .env to regenerate secrets."
  fi
fi

log_step "Preparing environment file"
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo "Created .env from .env.example"
  else
    echo "Missing .env and .env.example. Aborting."
    exit 1
  fi
fi

log_step "Loading environment"
set -a
source ./.env
set +a

should_install_deps() {
  if [ ! -d node_modules ]; then
    return 0
  fi
  if [ ! -f package-lock.json ]; then
    return 1
  fi
  if [ package-lock.json -nt node_modules ]; then
    return 0
  fi
  return 1
}

log_step "Installing npm dependencies"
if should_install_deps; then
  npm install
else
  echo "Dependencies already installed; skipping npm install."
fi
ensure_prisma_latest
ensure_node_packages @prisma/adapter-pg pg
ensure_node_dev_packages @types/pg

TS_NODE="./node_modules/.bin/ts-node"
TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS"}'
RESET_DB_DONE="0"
if [ -x ./node_modules/.bin/prisma ]; then
  PRISMA_CMD=("./node_modules/.bin/prisma")
else
  echo "Prisma CLI not found in node_modules. Run npm install."
  exit 1
fi

run_prisma() {
  "${PRISMA_CMD[@]}" "$@"
}

resolve_migration_if_needed() {
  local migration_name="$1"
  local output
  set +e
  output="$(run_prisma migrate resolve --applied "$migration_name" 2>&1)"
  local status=$?
  set -e
  if [ $status -eq 0 ]; then
    return 0
  fi
  if printf '%s' "$output" | grep -q "P3008"; then
    echo "Migration ${migration_name} already marked as applied; skipping."
    return 0
  fi
  printf '%s\n' "$output"
  return $status
}

log_step "Generating Prisma client"
run_prisma generate

log_step "Bootstrapping secrets"
"$TS_NODE" --compiler-options "$TS_NODE_COMPILER_OPTIONS" scripts/bootstrap-secrets.ts
if [ -f .ambmail.secrets ]; then
  echo "Generated secrets stored in .ambmail.secrets"
fi

log_step "Reloading environment with secrets"
set -a
source ./.env
set +a

START_POSTGRES="${AMBMAIL_START_POSTGRES:-1}"
SETUP_DB="${AMBMAIL_SETUP_DB:-0}"
AUTO_SETUP_DB_ON_FAIL="${AMBMAIL_AUTO_SETUP_DB_ON_FAIL:-1}"
if [ "$START_POSTGRES" = "1" ] || [ "$START_POSTGRES" = "true" ]; then
  log_step "Ensuring PostgreSQL is running"
  ensure_cmd psql postgresql-client
  ensure_cmd pg_isready postgresql-client
  if have_cmd brew; then
    ensure_cmd postgres postgresql
  fi
  if command -v systemctl >/dev/null 2>&1; then
    if systemctl list-unit-files 2>/dev/null | awk '{print $1}' | grep -q '^postgresql\.service$'; then
      sudo systemctl start postgresql
    else
      SERVICE_NAME="$(systemctl list-unit-files 2>/dev/null | awk '{print $1}' | grep -E '^postgresql@.+\.service$' | grep -v '^postgresql@\.service$' | head -n1 || true)"
      if [ -n "$SERVICE_NAME" ]; then
        sudo systemctl start "$SERVICE_NAME"
      else
        if command -v pg_lsclusters >/dev/null 2>&1 && command -v pg_ctlcluster >/dev/null 2>&1; then
          CLUSTER_INFO="$(pg_lsclusters --no-header 2>/dev/null | awk 'NR==1 {print $1" "$2}')"
          if [ -n "$CLUSTER_INFO" ]; then
            CLUSTER_VERSION="$(printf '%s\n' "$CLUSTER_INFO" | awk '{print $1}')"
            CLUSTER_NAME="$(printf '%s\n' "$CLUSTER_INFO" | awk '{print $2}')"
            sudo pg_ctlcluster "$CLUSTER_VERSION" "$CLUSTER_NAME" start
          else
            echo "No PostgreSQL cluster found. Install PostgreSQL or start it manually."
          fi
        else
          echo "No PostgreSQL systemd service found. Install PostgreSQL or start it manually."
        fi
      fi
    fi
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
  log_step "Setting up local database"
  if [ -x ./scripts/setup_postgres_local.sh ]; then
    ./scripts/setup_postgres_local.sh
  else
    echo "Missing scripts/setup_postgres_local.sh. Cannot auto-setup DB."
    exit 1
  fi
else
  echo "Skipping automatic DB role/database creation (AMBMAIL_SETUP_DB=${SETUP_DB})."
fi

DB_USER="${POSTGRES_USER:-ambmail}"
DB_NAME="${POSTGRES_DB:-ambmail_db}"
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

is_true() {
  [ "$1" = "1" ] || [ "$1" = "true" ]
}

is_local_db_host() {
  [ "$host" = "localhost" ] || [ "$host" = "127.0.0.1" ] || [ "$host" = "::1" ]
}

attempt_local_db_setup() {
  if ! is_true "$AUTO_SETUP_DB_ON_FAIL"; then
    return 1
  fi
  if ! is_local_db_host; then
    return 1
  fi
  if [ ! -x ./scripts/setup_postgres_local.sh ]; then
    return 1
  fi
  echo "Attempting automatic local DB setup..."
  ./scripts/setup_postgres_local.sh
}

log_step "Checking database readiness"
if command -v pg_isready >/dev/null 2>&1; then
  if [ -n "$password" ]; then
    PGPASSWORD="$password" pg_isready -h "$host" -p "$port" -U "$user" -d "$db" >/dev/null 2>&1 || {
      echo "Database is not ready ($host:$port)."
      if attempt_local_db_setup; then
        PGPASSWORD="$password" pg_isready -h "$host" -p "$port" -U "$user" -d "$db" >/dev/null 2>&1 || {
          echo "Database is still not ready after setup attempt. Ensure PostgreSQL is running and DATABASE_URL is correct."
          exit 1
        }
      else
        echo "Run scripts/setup_postgres_local.sh or create the role/db manually."
        exit 1
      fi
    }
  else
    pg_isready -h "$host" -p "$port" -U "$user" -d "$db" >/dev/null 2>&1 || {
      echo "Database is not ready ($host:$port)."
      if attempt_local_db_setup; then
        pg_isready -h "$host" -p "$port" -U "$user" -d "$db" >/dev/null 2>&1 || {
          echo "Database is still not ready after setup attempt. Ensure PostgreSQL is running and DATABASE_URL is correct."
          exit 1
        }
      else
        echo "Run scripts/setup_postgres_local.sh or create the role/db manually."
        exit 1
      fi
    }
  fi
  if command -v psql >/dev/null 2>&1; then
    if [ -z "$db" ] || [ -z "$user" ] || [ -z "$host" ]; then
      echo "Database configuration is incomplete. Check DATABASE_URL."
      exit 1
    fi
    if [ -n "$password" ]; then
      PGPASSWORD="$password" psql -h "$host" -p "$port" -U "$user" -d "$db" -c 'select 1' >/dev/null 2>&1 || {
        echo "Cannot connect to database."
        if attempt_local_db_setup; then
          PGPASSWORD="$password" psql -h "$host" -p "$port" -U "$user" -d "$db" -c 'select 1' >/dev/null 2>&1 || {
            echo "Cannot connect to database after setup attempt. Run scripts/setup_postgres_local.sh manually."
            exit 1
          }
        else
          echo "Run scripts/setup_postgres_local.sh or create the role/db manually."
          exit 1
        fi
      }
    else
      psql -h "$host" -p "$port" -U "$user" -d "$db" -c 'select 1' >/dev/null 2>&1 || {
        echo "Cannot connect to database."
        if attempt_local_db_setup; then
          psql -h "$host" -p "$port" -U "$user" -d "$db" -c 'select 1' >/dev/null 2>&1 || {
            echo "Cannot connect to database after setup attempt. Run scripts/setup_postgres_local.sh manually."
            exit 1
          }
        else
          echo "Run scripts/setup_postgres_local.sh or create the role/db manually."
          exit 1
        fi
      }
    fi
  else
    echo "psql not found; skipping DB connectivity check."
  fi
else
  echo "pg_isready not found; skipping DB readiness check."
fi

log_step "Syncing database schema"
if [ "$RESET_STATE" = "1" ] || [ "$RESET_STATE" = "true" ]; then
  echo "Resetting database..."
  run_prisma db push --force-reset --accept-data-loss
  RESET_DB_DONE="1"
fi

if [ "$RESET_DB_DONE" = "0" ]; then
  if [ -d prisma/migrations ] && [ "$(find prisma/migrations -mindepth 1 -maxdepth 1 -type d | wc -l)" -gt 0 ]; then
    has_migration_table="false"
    if command -v psql >/dev/null 2>&1 && [ -n "${host:-}" ] && [ -n "${db:-}" ]; then
      if [ -n "${password:-}" ]; then
        has_migration_table="$(PGPASSWORD="$password" psql -h "$host" -p "${port:-5432}" -U "$user" -d "$db" -tAc "SELECT to_regclass('public._prisma_migrations') IS NOT NULL" 2>/dev/null | tr -d '[:space:]')"
      else
        has_migration_table="$(psql -h "$host" -p "${port:-5432}" -U "$user" -d "$db" -tAc "SELECT to_regclass('public._prisma_migrations') IS NOT NULL" 2>/dev/null | tr -d '[:space:]')"
      fi
    fi

    if [ "$has_migration_table" = "true" ]; then
      run_prisma migrate deploy
    else
      run_prisma db push --accept-data-loss
      for dir in prisma/migrations/*; do
        if [ -d "$dir" ]; then
          resolve_migration_if_needed "$(basename "$dir")"
        fi
      done
    fi
  else
    run_prisma db push --accept-data-loss
  fi
else
  if [ -d prisma/migrations ] && [ "$(find prisma/migrations -mindepth 1 -maxdepth 1 -type d | wc -l)" -gt 0 ]; then
    for dir in prisma/migrations/*; do
      if [ -d "$dir" ]; then
        resolve_migration_if_needed "$(basename "$dir")"
      fi
    done
  fi
fi

log_step "Starting background sync worker"
"$TS_NODE" --compiler-options "$TS_NODE_COMPILER_OPTIONS" scripts/sync-worker.ts &
WORKER_PID=$!
trap 'kill $WORKER_PID 2>/dev/null' EXIT

log_step "Starting app server (frontend + backend)"
APP_PORT="3000"
PORT_CHECK_PID=""
if command -v lsof >/dev/null 2>&1; then
  (
    while [ -d /proc/$PPID ]; do
      if lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null | awk '$1=="node" && $9 ~ /:3000$/ {found=1} END {exit !found}'; then
        APP_PORT="3000"
        break
      fi
      if lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null | awk '$1=="node" && $9 ~ /:3001$/ {found=1} END {exit !found}'; then
        APP_PORT="3001"
        break
      fi
      if lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null | awk '$1=="node" && $9 ~ /:3002$/ {found=1} END {exit !found}'; then
        APP_PORT="3002"
        break
      fi
      if lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null | awk '$1=="node" && $9 ~ /:3003$/ {found=1} END {exit !found}'; then
        APP_PORT="3003"
        break
      fi
      if lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null | awk '$1=="node" && $9 ~ /:3004$/ {found=1} END {exit !found}'; then
        APP_PORT="3004"
        break
      fi
      sleep 0.2
    done
    if [ -n "$APP_PORT" ]; then
      echo "App: http://localhost:${APP_PORT}"
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
