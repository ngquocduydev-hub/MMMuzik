#!/usr/bin/env bash
# MMMuzik V2 — PostgreSQL backup (the only source-of-truth store; Redis is
# rebuildable per docs/DATABASE.md). Dumps the DB from the running container to
# a gzipped, date-stamped file and prunes anything older than RETENTION_DAYS.
#
# Usage:        ./deploy/backup.sh
# Cron (daily 03:15):
#   15 3 * * *  cd /opt/mmmuzik/MMMuzik && ./deploy/backup.sh >> /var/log/mmmuzik-backup.log 2>&1
set -euo pipefail

cd "$(dirname "$0")/.."

# shellcheck disable=SC1091
set -a; source .env.production; set +a

RETENTION_DAYS="${RETENTION_DAYS:-7}"
OUT_DIR="./backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="${OUT_DIR}/mmmuzik-${STAMP}.sql.gz"
COMPOSE="docker compose --env-file .env.production -f docker-compose.prod.yml"

mkdir -p "${OUT_DIR}"

echo "### Dumping database '${POSTGRES_DB}' → ${FILE}"
$COMPOSE exec -T postgres pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" | gzip > "${FILE}"

echo "### Pruning backups older than ${RETENTION_DAYS} days"
find "${OUT_DIR}" -name 'mmmuzik-*.sql.gz' -type f -mtime "+${RETENTION_DAYS}" -delete

echo "### Done. Current backups:"
ls -lh "${OUT_DIR}"

# Restore (manual):
#   gunzip -c backups/mmmuzik-YYYYMMDD-HHMMSS.sql.gz \
#     | docker compose --env-file .env.production -f docker-compose.prod.yml \
#       exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
