#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example. Update passwords in NC_image/.env if needed."
fi

NC_PORT="$(grep -E '^NC_PORT=' .env | tail -n1 | cut -d= -f2- || true)"
NC_PORT="${NC_PORT%\"}"
NC_PORT="${NC_PORT#\"}"
NC_PORT="${NC_PORT:-8084}"

echo "Starting Nextcloud stack..."
docker compose up -d

echo "Running bootstrap (users, without oauth2 client auto-creation)..."
AUTO_CREATE_OAUTH_CLIENT=false ./scripts/bootstrap.sh

echo
echo "Done."
echo "Nextcloud: http://localhost:${NC_PORT}"
echo "OAuth2 credentials are not created automatically in start_nc.sh."
echo "To create them manually: AUTO_CREATE_OAUTH_CLIENT=true ./scripts/bootstrap.sh"
