#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Stop existing containers
echo "Stopping existing containers..."
docker compose down 2>/dev/null || true

# Use .env.local if it exists, otherwise try to decrypt .env
if [ -f .env.local ]; then
  echo "Using .env.local for environment variables"
  export COMPOSE_ENV_FILE=".env.local"
  docker compose --env-file .env.local "$@"
elif command -v ansible-vault >/dev/null 2>&1; then
  echo "Decrypting .env file with ansible-vault..."
  ansible-vault view .env > .env.decrypted 2>/dev/null || {
    echo "Failed to decrypt .env file"
    exit 1
  }
  export COMPOSE_ENV_FILE=".env.decrypted"
  trap 'rm -f .env.decrypted' EXIT
  docker compose --env-file .env.decrypted "$@"
else
  echo "Using .env file directly (assuming it's unencrypted)"
  docker compose "$@"
fi
