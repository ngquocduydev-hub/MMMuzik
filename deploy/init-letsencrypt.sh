#!/usr/bin/env bash
# MMMuzik V2 — one-time Let's Encrypt bootstrap for the containerized nginx.
#
# Solves the chicken-and-egg: nginx won't start without a cert, but certbot
# can't get a cert without nginx serving the http-01 challenge. We:
#   1) drop a temporary self-signed cert so nginx can start,
#   2) start nginx (serves the ACME challenge on :80),
#   3) delete the dummy and request the REAL cert via the webroot challenge,
#   4) reload nginx with the real cert.
#
# Run ONCE on the VPS after DNS points at the server and the stack can build:
#   chmod +x deploy/init-letsencrypt.sh && ./deploy/init-letsencrypt.sh
#
# Reads DOMAIN / CERTBOT_EMAIL / STAGING from .env.production.
#
# NOTE on `docker compose run --entrypoint`: it sets ONLY the executable (argv[0]),
# it is NOT shell-split. So we use `--entrypoint sh <service> -c '<script>'` for
# shell steps, and the certbot image's DEFAULT entrypoint (`certbot`) for the
# issuance step (`run --rm certbot certonly ...`). The TLS policy is inlined in the
# nginx conf, so no options-ssl-nginx.conf download / dhparam file is needed.
set -euo pipefail

cd "$(dirname "$0")/.."

# shellcheck disable=SC1091
set -a; source .env.production; set +a

DOMAIN="${DOMAIN:-muzikskul.xyz}"
EMAIL="${CERTBOT_EMAIL:?Set CERTBOT_EMAIL in .env.production}"
STAGING="${STAGING:-0}"                 # 1 = Let's Encrypt staging (avoids rate limits while testing)
DOMAINS=(-d "${DOMAIN}" -d "www.${DOMAIN}")
COMPOSE="docker compose --env-file .env.production -f docker-compose.prod.yml"
LIVE_PATH="/etc/letsencrypt/live/${DOMAIN}"

echo "### [1/5] Building image + starting app/postgres/redis ..."
$COMPOSE up -d --build app

echo "### [2/5] Creating a temporary self-signed cert so nginx can boot ..."
$COMPOSE run --rm --entrypoint sh certbot -c "\
  mkdir -p ${LIVE_PATH} && \
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout ${LIVE_PATH}/privkey.pem \
    -out ${LIVE_PATH}/fullchain.pem \
    -subj '/CN=localhost'"

echo "### [3/5] Starting nginx (serving the http-01 challenge on :80) ..."
$COMPOSE up -d nginx

echo "### [4/5] Replacing the dummy cert with a real Let's Encrypt certificate ..."
$COMPOSE run --rm --entrypoint sh certbot -c "rm -rf ${LIVE_PATH}"

STAGING_ARG=""
if [ "${STAGING}" != "0" ]; then STAGING_ARG="--staging"; fi

# Default entrypoint is `certbot`; pass the command + args directly.
$COMPOSE run --rm certbot certonly --webroot -w /var/www/certbot \
  ${STAGING_ARG} \
  --email "${EMAIL}" "${DOMAINS[@]}" \
  --rsa-key-size 2048 --agree-tos --no-eff-email

echo "### [5/5] Reloading nginx with the real cert + starting the renew loop ..."
$COMPOSE exec nginx nginx -s reload
$COMPOSE up -d certbot

echo "### Done. Visit https://${DOMAIN}"
