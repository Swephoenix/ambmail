#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_CMD=(docker compose)
SECRETS_DIR="${ROOT_DIR}/secrets"
CLIENT_FILE="${SECRETS_DIR}/oauth2-client.txt"

if [[ ! -f "${ROOT_DIR}/.env" ]]; then
  echo "Missing ${ROOT_DIR}/.env. Copy .env.example first."
  exit 1
fi

dotenv_get() {
  local key="$1"
  local default_value="${2:-}"
  local line

  line="$(grep -E "^${key}=" "${ROOT_DIR}/.env" | tail -n1 || true)"
  if [[ -z "${line}" ]]; then
    echo "${default_value}"
    return 0
  fi

  line="${line#*=}"
  # Trim optional surrounding double quotes.
  line="${line%\"}"
  line="${line#\"}"
  echo "${line}"
}

DEMO_USER_1="$(dotenv_get DEMO_USER_1 demo1)"
DEMO_USER_1_PASSWORD="$(dotenv_get DEMO_USER_1_PASSWORD demo1_password)"
DEMO_USER_2="$(dotenv_get DEMO_USER_2 demo2)"
DEMO_USER_2_PASSWORD="$(dotenv_get DEMO_USER_2_PASSWORD demo2_password)"
OAUTH_CLIENT_NAME="$(dotenv_get OAUTH_CLIENT_NAME uxmail-local)"
OAUTH_REDIRECT_URI="$(dotenv_get OAUTH_REDIRECT_URI http://localhost:3000/api/nextcloud/auth/callback)"
NC_PORT="$(dotenv_get NC_PORT 8084)"
MYSQL_PASSWORD="$(dotenv_get MYSQL_PASSWORD)"

mkdir -p "${SECRETS_DIR}"

occ() {
  "${COMPOSE_CMD[@]}" exec -T -u 33 app php occ "$@"
}

is_nextcloud_installed() {
  local status_out
  status_out="$(occ status 2>/dev/null || true)"
  grep -qi '^  - installed: true$' <<<"${status_out}"
}

wait_for_nextcloud() {
  echo "Waiting for Nextcloud installation to complete..."
  local retries=180
  local i
  for ((i=1; i<=retries; i++)); do
    if is_nextcloud_installed; then
      echo "Nextcloud is installed and ready."
      return 0
    fi
    sleep 2
  done
  echo "Timed out while waiting for Nextcloud installation." >&2
  occ status || true
  return 1
}

create_user_if_missing() {
  local user="$1"
  local pass="$2"

  if [[ -z "${user}" || -z "${pass}" ]]; then
    echo "Skipping empty user/password pair."
    return 0
  fi

  if occ user:info "${user}" >/dev/null 2>&1; then
    echo "User ${user} already exists."
    return 0
  fi

  echo "Creating user ${user}..."
  "${COMPOSE_CMD[@]}" exec -T --env "OC_PASS=${pass}" -u 33 app php occ user:add --password-from-env "${user}"
}

enable_oauth2_app() {
  if occ app:list | grep -q '^  - oauth2:'; then
    echo "oauth2 app already enabled."
  else
    echo "Enabling oauth2 app..."
    occ app:enable oauth2
  fi
}

create_oauth_client_if_missing() {
  if [[ -f "${CLIENT_FILE}" ]]; then
    echo "OAuth2 client output already exists at ${CLIENT_FILE}; skipping creation."
    return 0
  fi

  local client_name="${OAUTH_CLIENT_NAME}"
  local redirect_uri="${OAUTH_REDIRECT_URI}"

  if occ list 2>/dev/null | grep -q 'oauth2:add-client'; then
    echo "Creating OAuth2 client '${client_name}' with redirect '${redirect_uri}'..."
    occ oauth2:add-client "${client_name}" "${redirect_uri}" > "${CLIENT_FILE}"
    echo "OAuth2 client created. Raw output saved to ${CLIENT_FILE}."
    return 0
  fi

  create_oauth_client_via_legacy_import "${client_name}" "${redirect_uri}"
}

print_oauth_summary() {
  if [[ ! -f "${CLIENT_FILE}" ]]; then
    return 0
  fi

  local client_id
  local client_secret

  client_id="$( (grep -Eio '(client id|identifier)[: ]+[A-Za-z0-9._-]+' "${CLIENT_FILE}" | head -n1 | awk '{print $NF}') || true )"
  client_secret="$( (grep -Eio '(client secret|secret)[: ]+[A-Za-z0-9._-]+' "${CLIENT_FILE}" | head -n1 | awk '{print $NF}') || true )"

  echo
  echo "OAuth2 setup summary:"
  if [[ -n "${client_id}" ]]; then
    echo "NC_OAUTH_CLIENT_ID=${client_id}"
  else
    echo "NC_OAUTH_CLIENT_ID=<read from ${CLIENT_FILE}>"
  fi

  if [[ -n "${client_secret}" ]]; then
    echo "NC_OAUTH_CLIENT_SECRET=${client_secret}"
  else
    echo "NC_OAUTH_CLIENT_SECRET=<read from ${CLIENT_FILE}>"
  fi
  echo
  echo "Nextcloud URL: http://localhost:${NC_PORT}"
  echo "Redirect URI: ${OAUTH_REDIRECT_URI}"
}

sql_escape() {
  printf "%s" "$1" | sed "s/'/''/g"
}

create_oauth_client_via_legacy_import() {
  local client_name="$1"
  local redirect_uri="$2"

  if [[ -z "${MYSQL_PASSWORD}" ]]; then
    echo "MYSQL_PASSWORD is missing in .env; cannot create OAuth2 client fallback." >&2
    return 1
  fi

  local client_id
  local client_secret
  client_id="uxmail-$(od -An -N10 -tx1 /dev/urandom | tr -d ' \n')"
  client_secret="$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')"

  echo "Using OAuth2 legacy import fallback (Nextcloud 29+ compatibility)..."
  occ config:system:set oauth2.enable_oc_clients --type=boolean --value=true
  if ! occ oauth2:import-legacy-oc-client "${client_id}" "${client_secret}"; then
    echo "Failed to run oauth2:import-legacy-oc-client. OAuth2 client could not be created automatically." >&2
    return 1
  fi

  local esc_name
  local esc_redirect
  local esc_client_id
  esc_name="$(sql_escape "${client_name}")"
  esc_redirect="$(sql_escape "${redirect_uri}")"
  esc_client_id="$(sql_escape "${client_id}")"

  "${COMPOSE_CMD[@]}" exec -T db mariadb -unextcloud "-p${MYSQL_PASSWORD}" nextcloud -e \
    "UPDATE oc_oauth2_clients SET name='${esc_name}', redirect_uri='${esc_redirect}' WHERE client_identifier='${esc_client_id}';"

  cat > "${CLIENT_FILE}" <<EOF
Client ID: ${client_id}
Client Secret: ${client_secret}
Name: ${client_name}
Redirect URI: ${redirect_uri}
EOF
  echo "OAuth2 client created via fallback. Credentials saved to ${CLIENT_FILE}."
}

main() {
  wait_for_nextcloud
  enable_oauth2_app
  create_user_if_missing "${DEMO_USER_1}" "${DEMO_USER_1_PASSWORD}"
  create_user_if_missing "${DEMO_USER_2}" "${DEMO_USER_2_PASSWORD}"
  create_oauth_client_if_missing
  print_oauth_summary

  echo "Bootstrap done."
}

main "$@"
