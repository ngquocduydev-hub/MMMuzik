# MMMuzik V2

> **Share a link. Listen together. Right now.**
>
> A real-time collaborative music-listening web app. Create a room, share a code/link, and everyone hears the same song at the same position at the same moment. One host controls playback; anyone can add to the shared queue; everyone can chat.

**Status: Phase 1 — project foundation only.** No product features are implemented yet (no rooms, playback, queue, chat, YouTube, or sync engine). This phase establishes the infrastructure the features will be built on.

---

## Tech stack

| Concern | Choice |
|---------|--------|
| Language | TypeScript (strict) |
| App framework | Next.js 15 (App Router) — full-stack, single origin |
| Realtime | Socket.IO (+ Redis adapter) over a custom Node server |
| Database | PostgreSQL via Prisma |
| Cache / coordination | Redis |
| Packaging | Docker + Docker Compose |

The architecture, behavior, and rationale live in [`/docs`](./docs) and [`CLAUDE.md`](./CLAUDE.md). **Read `CLAUDE.md` first** — it is the project operating manual.

---

## Prerequisites

- **Node.js ≥ 20** and **pnpm** (via Corepack: `corepack enable pnpm`)
- **Docker** + **Docker Compose** (for Postgres/Redis, and to run the full stack)

---

## Quick start (Docker — recommended)

Runs app + Postgres + Redis, applies migrations, and serves on port 3000:

```bash
docker compose up
```

Then verify:

```bash
curl http://localhost:3000/api/health
# → {"status":"healthy"}
```

Open <http://localhost:3000>.

### Development with Docker (hot reload)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

This mounts your source, runs `prisma generate` + `migrate deploy`, and starts the dev server (`tsx watch`) with hot reload.

---

## Local setup (without Docker for the app)

Bring up just the infrastructure with Docker, run the app on your host:

```bash
# 1. Start Postgres + Redis only
docker compose up -d postgres redis

# 2. Install dependencies
pnpm install

# 3. Configure env
cp .env.example .env            # defaults point at localhost Postgres/Redis

# 4. Apply the database schema
pnpm db:migrate                 # prisma migrate dev (creates/apply migration)

# 5. Run the dev server (Next + Socket.IO via the custom server)
pnpm dev
```

App: <http://localhost:3000> · Health: <http://localhost:3000/api/health>

---

## Scripts

| Script | Purpose |
|--------|---------|
| `pnpm dev` | Custom server (Next + Socket.IO) with hot reload (`tsx watch`) |
| `pnpm build` | `prisma generate` + `next build` |
| `pnpm start` | Production server (`NODE_ENV=production tsx src/server/index.ts`) |
| `pnpm lint` / `pnpm lint:fix` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm format` / `pnpm format:check` | Prettier |
| `pnpm db:migrate` | Create + apply a dev migration |
| `pnpm db:deploy` | Apply migrations (CI/deploy step) |
| `pnpm db:generate` | Regenerate the Prisma client |
| `pnpm db:studio` | Prisma Studio |

> **Migrations are an explicit step, never run on app boot** (avoids V1's DDL crash-loop — see `docs/LESSONS_LEARNED.md` L-9.1). In production use a privileged migration role for `db:deploy`; the runtime role has DML only.

---

## Folder structure

```
mmmuzik-v2/
├─ docs/                     # design docs (source of truth) — read CLAUDE.md first
├─ prisma/                   # schema.prisma + migrations (placeholder models)
├─ src/
│  ├─ app/                   # Next.js App Router — UI (composition only) + REST
│  │  └─ api/health/route.ts # GET /api/health (verifies DB + Redis)
│  ├─ features/              # feature-based UI (placeholders)
│  │  ├─ room/ playback/ queue/ chat/ youtube/
│  ├─ server/                # backend layers (custom server + socket)
│  │  ├─ index.ts            # custom server: boots Next + Socket.IO
│  │  ├─ socket/             # io · namespace · auth · lifecycle (no events yet)
│  │  ├─ services/           # application logic (placeholder)
│  │  └─ repositories/       # data access (placeholder)
│  ├─ shared/                # pure shared types/constants (future contracts)
│  └─ lib/                   # prisma · redis · config · logger · health
├─ Dockerfile · docker-compose.yml · docker-compose.dev.yml
└─ CLAUDE.md                 # project operating manual
```

**Layering rules** (enforced by ESLint): `src/shared` is pure — it may not import `lib`, `server`, Prisma, Redis, Socket.IO, or Next. UI composes in `app`/`features`; network access lives in services; the database is reached only through repositories.

---

## Development workflow

1. **Read `CLAUDE.md`** and the relevant doc in `/docs` (`SPEC.md` for behavior, `ARCHITECTURE.md` for structure, etc.).
2. Define/extend shared types first, then domain/use-case, then adapters, then the entrypoint (REST and/or Socket.IO), then UI.
3. Keep business logic out of components and out of stores; reconcile the UI to server-authoritative state.
4. **Code and docs ship together** — a behavior change updates `SPEC.md` in the same PR.
5. Pre-commit runs ESLint + Prettier on staged files (Husky + lint-staged).

---

## License

Private / internal (Phase 1).
