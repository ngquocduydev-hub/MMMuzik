# MMMuzik V2 — Production Deployment Guide

Deploy MMMuzik to a fresh **Ubuntu VPS**, fully in **Docker**, served at
**https://muzikskul.xyz** (root + `www`) with Let's Encrypt SSL, working
Socket.IO, automatic migrations, auto-restart on reboot, and **only ports 80/443
public** (Postgres/Redis private).

> Replace `<VPS_IP>` with your server's public IP throughout. Run everything as
> `root` (or a sudo user). Commands assume the repo lives at `/opt/mmmuzik/MMMuzik`.

---

## 0. Audit summary — what we're deploying (verified against the code)

| Item | Value | Why it matters for deploy |
|------|-------|---------------------------|
| **Process model** | ONE Node process (`src/server/index.ts`, via `tsx`) | Next.js UI + REST + Socket.IO are co-hosted — there is **no separate frontend/backend port**. |
| **App port** | **3000** (`/socket.io/` on the same port) | Nginx proxies a single upstream `app:3000`. |
| **Postgres / Redis** | 16-alpine / 7-alpine | Redis also backs the Socket.IO Redis adapter. |
| **Socket.IO CORS** | `origin = APP_URL` (`src/server/socket/io.ts`) | `APP_URL` must be **exactly** `https://muzikskul.xyz`; `www` is redirected to it. |
| **Session cookie** | `Secure` when `NODE_ENV=production` | HTTPS is mandatory. |
| **Migrations** | image does NOT auto-migrate; the app `command` runs `prisma migrate deploy && pnpm start` | Migrations apply automatically on each deploy. |
| **Health** | `GET /api/health` → `{"status":"healthy"}` (200) / 503 | Used by the container healthcheck and your smoke test. |
| **Build target** | Dockerfile `runner` (custom server, NOT `next start`/standalone) | `docker-compose.prod.yml` builds `target: runner`. |

---

## 1. Architecture

```
                          Internet
                             │
        DNS A records:  muzikskul.xyz → <VPS_IP>
                        www.muzikskul.xyz → <VPS_IP>
                             │
                   ┌─────────▼──────────┐   public ports: 80, 443 ONLY
                   │   nginx (container) │   • TLS termination (Let's Encrypt)
                   │   :80  :443         │   • WebSocket upgrade (/socket.io/)
                   │                     │   • www → root 301 redirect
                   └─────────┬───────────┘   • ACME http-01 challenge
                             │ proxy_pass http://app:3000   (internal bridge net)
                   ┌─────────▼───────────┐
                   │   app (container)   │   Next.js UI + REST + Socket.IO
                   │   :3000  (NOT published)
                   └───┬──────────────┬──┘
        internal only  │              │  internal only
              ┌────────▼───┐    ┌─────▼──────┐
              │ postgres   │    │ redis      │   cache + locks + Socket.IO adapter
              │ :5432      │    │ :6379      │
              │ (NOT pub.) │    │ (NOT pub.) │
              └─────┬──────┘    └─────┬──────┘
                 [pgdata]          [redisdata]            (Docker named volumes)

   ┌──────────────────────┐
   │  certbot (container)  │  renew loop every 12h → shared cert volume → nginx
   └──────────────────────┘
```

**Public surface = 80/443 (nginx) only.** `app`, `postgres`, and `redis` have **no
`ports:` mapping**, so they exist only on the internal Docker bridge network and
are unreachable from the internet — independent of the firewall.

**Files that define this stack** (in the repo):
- `docker-compose.prod.yml` — the 5 services + volumes.
- `deploy/nginx/conf.d/muzikskul.conf` — reverse proxy, WS upgrade, www→root, TLS.
- `deploy/init-letsencrypt.sh` — one-time SSL bootstrap.
- `.env.production.example` — environment template (copy to `.env.production`).
- `deploy/backup.sh` — Postgres backup.

---

## 2. DNS setup

At your domain registrar / DNS provider for `muzikskul.xyz`, create two **A**
records pointing at the VPS:

| Type | Name / Host | Value | TTL |
|------|-------------|-------|-----|
| A | `@` (root) | `<VPS_IP>` | 300–3600 |
| A | `www` | `<VPS_IP>` | 300–3600 |

(Equivalently, `www` may be a `CNAME` → `muzikskul.xyz`.)

> **Do DNS first.** Let's Encrypt validates via HTTP-01, which requires the domain
> to already resolve to the VPS and port 80 to be reachable. Verify propagation
> before issuing certs:
> ```bash
> dig +short muzikskul.xyz
> dig +short www.muzikskul.xyz   # both must return <VPS_IP>
> ```

---

## 3. VPS setup (Ubuntu)

```bash
# Update + basic tooling
apt update && apt -y upgrade
apt -y install git curl ca-certificates ufw

# Firewall: allow SSH + HTTP + HTTPS only, then enable.
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status
```

> **Docker + ufw caveat (read this):** Docker manipulates iptables directly and can
> bypass ufw for *published* ports. In this stack that's a non-issue **because only
> nginx publishes ports (80/443) and Postgres/Redis/app publish nothing** — they're
> never on a host port to begin with. ufw still protects SSH and is good defense in
> depth. Do **not** add `ports:` to postgres/redis "for debugging" on a public VPS.

---

## 4. Docker + Docker Compose setup

```bash
# Install Docker Engine + the Compose v2 plugin (official convenience script).
curl -fsSL https://get.docker.com | sh

# Enable Docker on boot (required so 'restart: unless-stopped' survives reboot).
systemctl enable --now docker

docker --version
docker compose version          # Compose v2 is a plugin: 'docker compose' (no hyphen)
```

---

## 5. Clone the repository

```bash
mkdir -p /opt/mmmuzik && cd /opt/mmmuzik
git clone https://github.com/ngquocduydev-hub/MMMuzik.git
cd MMMuzik
git checkout production          # deploy from the stable branch
```

---

## 6. Configure environment

```bash
cp .env.production.example .env.production
# Generate a strong DB password:
openssl rand -base64 24
nano .env.production
```
Set, at minimum:
- `POSTGRES_PASSWORD` — the generated secret (and put the **same** value inside `DATABASE_URL`).
- `CERTBOT_EMAIL` — a real address (Let's Encrypt expiry notices).
- Keep `APP_URL=https://muzikskul.xyz`, `DOMAIN=muzikskul.xyz`, `NODE_ENV=production`.
- Leave `STAGING=0` for real certs (set `1` only while testing to dodge rate limits).

`.env.production` is **gitignored** — never commit it.

---

## 7. Migrations

No manual step. The `app` service `command` is `prisma migrate deploy && pnpm
start`, so **migrations apply automatically** every time the app container starts
(deploys and updates included). To run them on demand:
```bash
docker compose --env-file .env.production -f docker-compose.prod.yml \
  exec app pnpm prisma migrate deploy
```

---

## 8. Build images

```bash
cd /opt/mmmuzik/MMMuzik
docker compose --env-file .env.production -f docker-compose.prod.yml build
```

---

## 9. Start containers + 10. Configure SSL (single bootstrap)

The first SSL issuance and container startup are handled by one script (it starts
postgres/redis/app, boots nginx with a temporary cert, then obtains the real
Let's Encrypt cert and reloads). **DNS (step 2) must already resolve to the VPS.**

```bash
chmod +x deploy/init-letsencrypt.sh
./deploy/init-letsencrypt.sh
```

After it finishes, the full stack is up. Confirm:
```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
# app / postgres / redis = healthy; nginx / certbot = running (Up)
```

> Nginx (`deploy/nginx/conf.d/muzikskul.conf`) is already configured — it's mounted
> into the container, so "configure Nginx" = editing that file + reloading. The
> certbot container then auto-renews every 12h and nginx reloads every 6h to pick
> up renewed certs.

For day-to-day start/stop after the initial bootstrap:
```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d     # start all
docker compose --env-file .env.production -f docker-compose.prod.yml down      # stop all (keeps volumes)
```

---

## 11. Configure DNS — see step 2 (do it before step 9/10).

---

## 12. Verify deployment

```bash
# HTTPS + security headers
curl -I https://muzikskul.xyz                       # 200, HSTS header present
curl -I http://muzikskul.xyz                        # 301 → https
curl -I https://www.muzikskul.xyz                   # 301 → https://muzikskul.xyz

# App health (proves Postgres + Redis are reachable from the app)
curl https://muzikskul.xyz/api/health               # {"status":"healthy"}

# WebSocket upgrade (Socket.IO). Expect HTTP/1.1 101 Switching Protocols.
npm i -g wscat 2>/dev/null || true
wscat -c "wss://muzikskul.xyz/socket.io/?EIO=4&transport=websocket"
#   …or in the browser at https://muzikskul.xyz, DevTools → Network → WS:
#   the /socket.io/ request should show status 101 and stay open.

# Containers + the security requirement (only 80/443 published)
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml ps --format '{{.Service}} {{.Ports}}'
#   nginx → 0.0.0.0:80->80, 0.0.0.0:443->443 ; app/postgres/redis → no published ports

# From your laptop, confirm DB/Redis are NOT reachable publicly (should hang/refuse):
nc -vz <VPS_IP> 5432   # connection refused / timeout
nc -vz <VPS_IP> 6379   # connection refused / timeout

# Reboot test (auto-restart): 
reboot
# …reconnect after ~30s and re-run `docker compose ... ps` — all services should be back Up.
```

---

## Backup strategy

- **Postgres is the only source of truth** (Redis is rebuildable — `docs/DATABASE.md`).
  Back up the DB with `deploy/backup.sh` (gzipped `pg_dump` → `./backups/`, pruned to
  `RETENTION_DAYS`, default 7).
  ```bash
  chmod +x deploy/backup.sh && ./deploy/backup.sh
  ```
- **Automate (daily 03:15):** `crontab -e` →
  ```
  15 3 * * * cd /opt/mmmuzik/MMMuzik && ./deploy/backup.sh >> /var/log/mmmuzik-backup.log 2>&1
  ```
- **Restore:**
  ```bash
  gunzip -c backups/mmmuzik-YYYYMMDD-HHMMSS.sql.gz \
    | docker compose --env-file .env.production -f docker-compose.prod.yml \
        exec -T postgres psql -U mmmuzik -d mmmuzik
  ```
- **Off-site:** copy `backups/` to object storage / another host periodically.
- **Volumes** holding state: `pgdata` (critical), `redisdata` (best-effort),
  `certbot_conf` (certs — re-issuable). Snapshotting the VPS disk also captures these.

## Rollback strategy

- **App code:** redeploy a known-good commit/tag.
  ```bash
  cd /opt/mmmuzik/MMMuzik
  git fetch --all && git checkout <good-commit-or-tag>
  docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build app
  ```
- **Database:** Prisma migrations have **no auto down-migrations**. If a migration is
  bad, either **forward-fix** (ship a corrective migration) or **restore the last
  backup** (see above). Always run `./deploy/backup.sh` *before* deploying a release
  that includes new migrations.
- **Fast revert of just the app** (no DB change): `git checkout <prev>` then
  `up -d --build app` — postgres/redis volumes are untouched.

## Update strategy

```bash
cd /opt/mmmuzik/MMMuzik
./deploy/backup.sh                                   # snapshot first (esp. if migrations)
git pull origin production                           # or merge develop → production, then pull
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
# The app container re-runs `prisma migrate deploy` on start, then serves the new build.
```
- Update only the app (DB/Redis unchanged): add `--no-deps app` to the `up` command.
- Brief downtime on a single instance while the app restarts (seconds). For
  zero-downtime you'd run multiple `app` replicas behind nginx with sticky sessions
  — the Redis adapter is already wired for that, but it's out of scope here.
- After updating, re-run the **step 12** verification.

---

## Troubleshooting guide

| Symptom | Likely cause | Fix |
|--------|--------------|-----|
| `certbot` fails: *challenge failed / 404* | DNS not propagated, or port 80 blocked | `dig +short muzikskul.xyz` must equal `<VPS_IP>`; `ufw status` shows 80 allowed; re-run `./deploy/init-letsencrypt.sh`. Use `STAGING=1` while iterating to avoid rate limits. |
| Site loads over HTTP but **HTTPS fails / cert error** | Cert not issued yet, or dummy cert still present | Re-run `./deploy/init-letsencrypt.sh`; check `docker compose ... logs certbot`. |
| **Socket.IO won't connect** (polling works, WS fails) | Proxy not upgrading, or origin ≠ APP_URL | Confirm `deploy/nginx/conf.d/muzikskul.conf` has the `Upgrade`/`Connection` headers (it does); ensure you're on `https://muzikskul.xyz` (not `www`, not IP) so the origin matches `APP_URL`. |
| **CORS error on the socket** | Browsing `www`/IP, or `APP_URL` wrong | `APP_URL` must be `https://muzikskul.xyz`; `www` is 301'd to root. Edit `.env.production`, then `up -d app`. |
| App container restarting / unhealthy | Missing env or DB not ready | `docker compose ... logs app`; verify `DATABASE_URL`/`REDIS_URL` in `.env.production`; the app fail-fasts if they're missing (`assertRuntimeConfig`). |
| `/api/health` → 503 | Postgres or Redis down | `docker compose ... ps`; `logs postgres` / `logs redis`. |
| Migrations didn't apply | App didn't (re)start, or migrate failed | Check `logs app` for `prisma migrate deploy`; run it manually (step 7). |
| `502 Bad Gateway` from nginx | App not up yet / crashed | `logs app`; once `app` is healthy nginx proxies fine (it reloads every 6h, or `nginx -s reload`). |
| Changes to nginx conf not taking effect | Needs reload | `docker compose ... exec nginx nginx -t && docker compose ... exec nginx nginx -s reload`. |

### Log commands
```bash
C="docker compose --env-file .env.production -f docker-compose.prod.yml"
$C logs -f app          # app (Next + Socket.IO) — structured pino logs
$C logs -f nginx        # access/error (proxy, TLS, WS upgrades)
$C logs -f certbot      # cert issuance / renewal
$C logs -f postgres
$C logs -f redis
$C logs --since 15m     # everything, last 15 minutes
```

### Restart commands
```bash
C="docker compose --env-file .env.production -f docker-compose.prod.yml"
$C restart app                     # restart just the app (re-runs migrate deploy)
$C restart nginx                   # restart the proxy
$C exec nginx nginx -s reload      # reload nginx WITHOUT dropping connections
$C up -d                           # reconcile/start everything
$C down && $C up -d                # full stop/start (volumes preserved)
$C ps                              # status + published ports
```

### Update commands
```bash
C="docker compose --env-file .env.production -f docker-compose.prod.yml"
./deploy/backup.sh                 # always back up first
git pull origin production
$C up -d --build                   # rebuild + recreate changed services (migrations auto-run)
$C up -d --build --no-deps app     # update ONLY the app
$C exec app pnpm prisma migrate deploy   # run migrations on demand
docker image prune -f              # reclaim space from old image layers
```

---

## Quick reference — full first deploy (copy/paste order)

```bash
# 1) DNS: point muzikskul.xyz + www → <VPS_IP>, wait for propagation (dig).
# 2) On the VPS:
apt update && apt -y install git curl ufw
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable
curl -fsSL https://get.docker.com | sh && systemctl enable --now docker
mkdir -p /opt/mmmuzik && cd /opt/mmmuzik
git clone https://github.com/ngquocduydev-hub/MMMuzik.git && cd MMMuzik
git checkout production
cp .env.production.example .env.production && nano .env.production   # set secrets
docker compose --env-file .env.production -f docker-compose.prod.yml build
chmod +x deploy/init-letsencrypt.sh && ./deploy/init-letsencrypt.sh
curl https://muzikskul.xyz/api/health        # {"status":"healthy"}
```
**Final URL:** https://muzikskul.xyz
