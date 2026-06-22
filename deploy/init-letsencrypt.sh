#!/usr/bin/env bash
# MMMuzik V2 — one-time Let's Encrypt bootstrap for the containerized nginx.
#
# Breaks the nginx<->certbot deadlock WITHOUT a fake cert, using the HTTP/HTTPS
# config split:
#   1) move the :443 (cert-gated) config OUT of conf.d so nginx boots on HTTP only,
#   2) start nginx — it now serves the ACME http-01 challenge on :80,
#   3) request the REAL cert via the webroot challenge,
#   4) move the :443 config back in and reload nginx with the real cert.
#
# Run ONCE on the VPS after DNS points at the server and the stack can build:
#   chmod +x deploy/init-letsencrypt.sh && ./deploy/init-letsencrypt.sh
#
# Reads DOMAIN / CERTBOT_EMAIL / STAGING from .env.production. Idempotent: safe to
# re-run if a previous attempt failed partway.
set -euo pipefail

cd "$(dirname "$0")/.."

# shellcheck disable=SC1091
set -a; source .env.production; set +a

DOMAIN="${DOMAIN:-muzikskul.xyz}"
EMAIL="${CERTBOT_EMAIL:?Set CERTBOT_EMAIL in .env.production}"
STAGING="${STAGING:-0}"                 # 1 = Let's Encrypt staging (avoids rate limits while testing)
DOMAINS=(-d "${DOMAIN}" -d "www.${DOMAIN}")
COMPOSE="docker compose --env-file .env.production -f docker-compose.prod.yml"
CONFD="deploy/nginx/conf.d"
SSL_CONF="${CONFD}/muzikskul-ssl.conf"          # active path (loaded by nginx)
SSL_HELD="deploy/nginx/muzikskul-ssl.conf.held" # parked OUTSIDE conf.d during bootstrap

echo "### [1/6] Building image + starting app/postgres/redis ..."
$COMPOSE up -d --build app

echo "### [2/6] Disabling the HTTPS block so nginx can boot on HTTP only ..."
# Move the cert-gated :443 config out of conf.d (nginx loads only *.conf INSIDE
# conf.d). With no cert reference left, nginx cannot crash on a missing certificate.
[ -f "${SSL_CONF}" ] && mv "${SSL_CONF}" "${SSL_HELD}" || true

echo "### [3/6] Starting nginx (HTTP only — serving the http-01 challenge on :80) ..."
$COMPOSE up -d --force-recreate nginx
$COMPOSE exec nginx nginx -t

echo "### [4/6] Requesting the real Let's Encrypt certificate (webroot http-01) ..."
# Clear any stale/partial lineage so certbot writes a clean one at the expected path.
$COMPOSE run --rm --entrypoint sh certbot -c \
  "rm -rf /etc/letsencrypt/live/${DOMAIN} /etc/letsencrypt/archive/${DOMAIN} /etc/letsencrypt/renewal/${DOMAIN}.conf"

STAGING_ARG=""
if [ "${STAGING}" != "0" ]; then STAGING_ARG="--staging"; fi

# IMPORTANT: --entrypoint certbot. The certbot SERVICE entrypoint is a `certbot
# renew` loop; without this override, `run` passes the args to that loop and runs
# `renew` ("No renewals were attempted") instead of actually issuing the cert.
$COMPOSE run --rm --entrypoint certbot certbot certonly --webroot -w /var/www/certbot \
  ${STAGING_ARG} \
  --email "${EMAIL}" "${DOMAINS[@]}" \
  --rsa-key-size 2048 --agree-tos --no-eff-email

echo "### [5/6] Re-enabling HTTPS and reloading nginx with the real cert ..."
[ -f "${SSL_HELD}" ] && mv "${SSL_HELD}" "${SSL_CONF}" || true
$COMPOSE exec nginx nginx -t
$COMPOSE exec nginx nginx -s reload

echo "### [6/6] Starting the certbot auto-renew loop ..."
$COMPOSE up -d certbot

echo "### Done. Visit https://${DOMAIN}"
