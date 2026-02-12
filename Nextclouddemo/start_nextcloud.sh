#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

env_file=".env"
if [ ! -f "${env_file}" ] && [ -f "../.env" ]; then
  env_file="../.env"
fi

read_env_value() {
  local key="$1"
  if [ ! -f "${env_file}" ]; then
    return 0
  fi
  sed -n "s/^${key}=//p" "${env_file}" | head -n1 | sed -E 's/^"(.*)"$/\1/'
}

pw="${NC_PASSWORD:-}"
if [ -z "${pw}" ]; then
  pw="$(read_env_value NC_PASSWORD)"
fi
pw="${pw:-NCDemo-Start123!}"

admin_user="${NC_ADMIN_USER:-}"
if [ -z "${admin_user}" ]; then
  admin_user="$(read_env_value NC_ADMIN_USER)"
fi
admin_user="${admin_user:-admin}"

nc_users="${NC_USERS:-}"
if [ -z "${nc_users}" ]; then
  nc_users="$(read_env_value NC_USERS)"
fi
nc_users="${nc_users:-user1 user2}"

trusted_domains="${NC_TRUSTED_DOMAINS:-}"
if [ -z "${trusted_domains}" ]; then
  trusted_domains="$(read_env_value NC_TRUSTED_DOMAINS)"
fi

uxmail_public_url="${UXMAIL_PUBLIC_URL:-}"
if [ -z "${uxmail_public_url}" ]; then
  uxmail_public_url="$(read_env_value UXMAIL_PUBLIC_URL)"
fi

port="${NC_PORT:-}"
if [ -z "${port}" ]; then
  port="$(read_env_value NC_PORT)"
fi
port="${port:-8084}"

port_in_use() {
  local p="$1"
  ss -ltn 2>/dev/null | awk '{print $4}' | grep -Eq "(^|:)${p}$"
}

if port_in_use "${port}"; then
  for candidate in $(seq $((port + 1)) $((port + 50))); do
    if ! port_in_use "${candidate}"; then
      port="${candidate}"
      break
    fi
  done
fi

export NC_PORT="${port}"
export NC_PASSWORD="${pw}"

# Start core services
docker compose up -d db nextcloud nginx

# Re-run init to (re)create users and wait until it is done
docker compose up --force-recreate nextcloud-init

trusted_domains_combined="localhost localhost:${port} 127.0.0.1 127.0.0.1:${port} ${trusted_domains}"
uxmail_host="$(printf '%s' "${uxmail_public_url}" | sed -E 's#^[a-zA-Z]+://##; s#/.*$##')"
uxmail_host="${uxmail_host%%:*}"
if [ -n "${uxmail_host}" ]; then
  trusted_domains_combined="${trusted_domains_combined} ${uxmail_host} ${uxmail_host}:${port}"
fi

trusted_domains_unique="$(printf '%s\n' ${trusted_domains_combined} | awk 'NF && !seen[$0]++')"
idx=0
for domain in ${trusted_domains_unique}; do
  docker compose exec -T -u 33 nextcloud php /var/www/html/occ config:system:set trusted_domains "${idx}" --value="${domain}" >/dev/null
  idx=$((idx + 1))
done

echo "Nextcloud running. Users ensured by nextcloud-init."
echo "Open Nextcloud at: http://localhost:${port}"
echo "Demo credentials:"
echo "  username: ${admin_user} | password: ${pw}"
for u in ${nc_users}; do
  echo "  username: ${u} | password: ${pw}"
done

# Force-reset user passwords to match .env
docker compose exec -u 33 nextcloud sh -c "OC_PASS='${pw}' php /var/www/html/occ user:resetpassword --password-from-env ${admin_user}"
for u in ${nc_users}; do
  docker compose exec -u 33 nextcloud sh -c "OC_PASS='${pw}' php /var/www/html/occ user:resetpassword --password-from-env ${u}"
done
