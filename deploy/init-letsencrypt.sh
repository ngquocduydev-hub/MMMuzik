#!/usr/bin/env bash
# MMMuzik V2 — one-time Let's Encrypt bootstrap for the containerized nginx.
#
# Solves the chicken-and-egg: nginx won't start without a cert, but certbot
# can't get a cert without nginx serving the http-01 challenge. We:
#   1) drop a temporary self-signed cert so nginx can start,
#   2) start nginx,
#   3) delete the dummy and request the REAL cert via the webroot challenge,
#   4) reload nginx with the real cert.
#
# Run ONCE on the VPS after DNS points at the server and the stack can build:
#   chmod +x deploy/init-letsencrypt.sh && ./deploy/init-letsencrypt.sh
#
# Reads DOMAIN / CERTBOT_EMAIL / STAGING from .env.production.
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

echo "### Building images + starting app/postgres/redis ..."
$COMPOSE up -d --build app

echo "### Writing recommended TLS options (referenced by the nginx conf) ..."
$COMPOSE run --rm --entrypoint "/bin/sh -c '\
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/src/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > /etc/letsencrypt/options-ssl-nginx.conf; \
  openssl dhparam -out /etc/letsencrypt/ssl-dhparams.pem 2048'" certbot

echo "### Creating a temporary self-signed cert so nginx can boot ..."
$COMPOSE run --rm --entrypoint "/bin/sh -c '\
  mkdir -p ${LIVE_PATH} && \
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout ${LIVE_PATH}/privkey.pem \
    -out ${LIVE_PATH}/fullchain.pem \
    -subj \"/CN=localhost\"'" certbot

echo "### Starting nginx (serving the http-01 challenge on :80) ..."
$COMPOSE up -d nginx

echo "### Deleting the dummy cert ..."
$COMPOSE run --rm --entrypoint "/bin/sh -c 'rm -rf ${LIVE_PATH}'" certbot

STAGING_ARG=""
if [ "${STAGING}" != "0" ]; then STAGING_ARG="--staging"; fi

echo "### Requesting the real certificate from Let's Encrypt ..."
$COMPOSE run --rm --entrypoint "certbot certonly --webroot -w /var/www/certbot \
  ${STAGING_ARG} \
  --email ${EMAIL} ${DOMAINS[*]} \
  --rsa-key-size 2048 --agree-tos --no-eff-email --force-renewal" certbot

echo "### Reloading nginx with the real cert ..."
$COMPOSE exec nginx nginx -s reload

echo "### Starting the certbot auto-renew loop ..."
$COMPOSE up -d certbot

echo "### Done. Visit https://${DOMAIN}"
