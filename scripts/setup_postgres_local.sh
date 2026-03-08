#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f .env ]; then
  echo "Missing .env. Copy .env.example to .env first."
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is not installed. Install PostgreSQL client tools first."
  exit 1
fi

set -a
source ./.env
set +a

DB_USER="${POSTGRES_USER:-ambmail}"
DB_PASSWORD="${POSTGRES_PASSWORD:-ambmailpassword}"
DB_NAME="${POSTGRES_DB:-ambmail_db}"

if [ -z "$DB_USER" ] || [ -z "$DB_NAME" ]; then
  echo "POSTGRES_USER/POSTGRES_DB missing in .env."
  exit 1
fi

echo "Creating role and database (requires sudo)..."

esc_user_literal="$(printf "%s" "$DB_USER" | sed "s/'/''/g")"
esc_pass_literal="$(printf "%s" "$DB_PASSWORD" | sed "s/'/''/g")"
esc_user_ident="$(printf "%s" "$DB_USER" | sed 's/\"/\"\"/g')"
esc_db_ident="$(printf "%s" "$DB_NAME" | sed 's/\"/\"\"/g')"

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${esc_user_literal}'" | grep -q 1; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE ROLE \"${esc_user_ident}\" LOGIN PASSWORD '${esc_pass_literal}';"
fi

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${esc_db_ident}'" | grep -q 1; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${esc_db_ident}\" OWNER \"${esc_user_ident}\";"
else
  echo "Database ${DB_NAME} already exists."
fi

echo "PostgreSQL setup complete."
