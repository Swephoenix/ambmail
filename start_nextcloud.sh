#!/usr/bin/env bash
set -euo pipefail

# Start core services
docker compose up -d db nextcloud

# Re-run init to (re)create users
docker compose up -d --force-recreate nextcloud-init

pw="$(grep '^NC_PASSWORD=' .env | cut -d= -f2-)"
echo "Nextcloud running. Users ensured by nextcloud-init."
echo "Login password for admin/user1/user2: ${pw}"

# Force-reset user passwords to match .env
docker compose exec -u 33 nextcloud sh -c "OC_PASS='${pw}' php /var/www/html/occ user:resetpassword --password-from-env admin"
docker compose exec -u 33 nextcloud sh -c "OC_PASS='${pw}' php /var/www/html/occ user:resetpassword --password-from-env user1"
docker compose exec -u 33 nextcloud sh -c "OC_PASS='${pw}' php /var/www/html/occ user:resetpassword --password-from-env user2"
