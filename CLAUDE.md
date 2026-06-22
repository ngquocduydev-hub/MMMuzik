# CLAUDE.md — MMMuzik V2 Operating Manual

> **This file is the permanent instruction set for every Claude Code session on MMMuzik V2.** Read it in full at the start of any session before writing code or making decisions. It is self-contained: you should be able to contribute correctly from this file alone, deferring to the linked design docs for depth.
>
> **MMMuzik V2 is a ground-up TypeScript rebuild** of the V1 product (a .NET/SignalR system, fully documented in `PROJECT_KNOWLEDGE.md`). V2 keeps every behavior V1 got right and removes the friction V1 paid for. The "why" behind every rule here lives in `LESSONS_LEARNED.md`.

## Document Map (read order)

1. **`PROJECT_KNOWLEDGE.md`** — V1 source of truth (business knowledge, architecture, lessons). Historical reference.
2. **`SPEC.md`** — *what* the product must do (behavior, acceptance criteria). Authoritative for behavior.
3. **`ARCHITECTURE.md`** — *how* V2 is built (system-wide structure). Authoritative for structure.
4. **`PLAYBACK_ENGINE.md`** — the synchronization engine (the hardest subsystem). Authoritative for sync.
5. **`REALTIME_ENGINE.md`** — the realtime transport, events, and protocols. Authoritative for realtime.
6. **`DATABASE.md`** — the data model (Postgres + Prisma + Redis). Authoritative for persistence.
7. **`LESSONS_LEARNED.md`** — V1 retrospective; the rationale behind every rule. Authoritative for "why."

When this file and a design doc disagree, the **design doc wins for its domain** (it's more specific); update this file to match.

---

# Project Overview

## Product vision
MMMuzik is a real-time collaborative music-listening web app. One person creates a **room**, shares a short code or invite link, and everyone who joins hears **the same song, at the same position, at the same moment**. Participants collaboratively build a shared **queue**, a single **host** controls playback, and everyone can **chat** live. The promise: **"Share a link. Listen together. Right now."**

It recreates "sharing a pair of headphones" for distributed groups with **zero onboarding friction** — no accounts, no installs. Media is never proxied; we embed each provider's own player and synchronize **control + position** only.

## Business goals
- Let a user start a synchronized session in **seconds**, with only a nickname.
- Keep all listeners synchronized to a single shared playback position (perceived drift **< 1 s**).
- Make queue curation collaborative (anyone adds) with clear single-host control (mirrors "whoever holds the aux").
- Survive blips, refreshes, and host departures without ending the session.
- Support multiple music sources (YouTube, Spotify) without re-streaming audio.

## User experience goals
- **Frictionless join:** join → listening in **< 2 s** (excluding provider buffering).
- **Invisible sync:** correction is smooth and inaudible in the common case; latecomers drop into the song mid-play at the right spot.
- **Resilience:** a refresh or network blip never loses your place, your identity, or (if host) your control.
- **Trust & clarity:** everyone sees who's present, who's host, and what's playing — consistently, in real time.
- **Graceful degradation:** if a provider hiccups (e.g., a YouTube bot wall), chat/queue/presence stay alive and an "Open on YouTube" hatch is always offered.

**Target scale (MVP):** up to **50 concurrent participants per room**, trusted small groups. Out of scope: accounts, public discovery, playlists/history, voice/video, AI recommendations, native apps, moderation beyond host-remove.

---

# Core Principles

1. **User experience first.** Every technical choice serves the listener's experience (sync, speed, resilience). If a "correct" implementation degrades UX, find another correct one.
2. **Realtime correctness over implementation simplicity.** Idempotency, ordering, and convergence are non-negotiable even when they add code. A simpler design that can drift or double-apply is wrong.
3. **Server-authoritative state.** The server holds the single source of truth (playback anchor, room state). Clients reconcile to it and are never canonical.
4. **Minimize unnecessary complexity.** Build the seam, not the broker. No infrastructure or abstraction that the current product doesn't need (V1 over-built a message bus it never relied on).
5. **Maintainability over cleverness.** Code reads like the surrounding code. Prefer the obvious, testable solution over the clever one. Optimize for the next engineer (human or AI).
6. **Consistency over novelty.** Match existing patterns and decisions. Do not introduce a second way to do something that already has a way.
7. **One contract, compile-checked.** Wire shapes live in one shared package; drift must be a compile error, never a runtime surprise.
8. **Determinism & testability.** The domain is pure and takes the clock as a parameter; business rules are unit-testable without infrastructure.

---

# Technology Stack

Mandated stack and the reason each was chosen (full rationale: `ARCHITECTURE.md` §2, `LESSONS_LEARNED.md`).

| Technology | Why |
|------------|-----|
| **TypeScript everywhere (strict)** | Kills V1's #1 problem — cross-language frontend↔backend contract drift. One language, one toolchain, one set of types from DB row to React prop. |
| **Next.js (App Router), full-stack** | SSR/RSC for fast first paint, Route Handlers for REST, **single origin** for UI + API (eliminates V1's baked-URL / CORS / cross-site-cookie class of bugs). Standalone Node output for containerized deploy. |
| **Socket.IO** | Mature WebSocket framework with rooms, acknowledgements (clean clock probes), auto-reconnect, and a **first-class Redis adapter** for horizontal fan-out — the exact capability V1 deferred and couldn't scale without. |
| **PostgreSQL** | Durable source of truth; unchanged from V1 because it worked. Strong relational guarantees for the Room aggregate + chat. |
| **Prisma** | Type-safe DB access that feeds the shared TypeScript types; declarative schema + migration workflow. |
| **Redis** | Hot read-through snapshots, rate-limit counters, advance/leader locks, presence, code→room lookup, **and** the Socket.IO adapter pub/sub. One coordination fabric (V1 needed Redis **and** RabbitMQ; V2 drops the broker). |
| **Zod** | Runtime validation at the boundary that doubles as the static type source — one definition guards the wire and types the code. |

> **Deliberately NOT in the stack:** message broker (RabbitMQ), heavy CQRS/mediator framework, build-time public URLs. Their value is retained in lighter form (Redis fan-out; plain use-case functions; runtime config).

---

# Architecture Rules

These are **mandatory**. Violations should be caught in review/CI.

- **Single repository (monorepo).** Workspaces + a task runner (pnpm + Turborepo). Apps are thin entrypoints; logic lives in shared packages.
- **TypeScript only, strict mode.** No JavaScript source, no `any` (use `unknown` + narrowing), no `@ts-ignore` without a justification comment.
- **Process split (dictated by WebSockets needing a long-lived server):**
  - `apps/web` — Next.js: UI (RSC/SSR) + REST Route Handlers.
  - `apps/realtime` — Socket.IO gateway (long-lived) + background workers (reapers, advance timer).
- **Shared packages with inward-only dependencies:**
  - `packages/contracts` — types, zod schemas, typed Socket.IO event maps, error catalog. **The single source of wire truth.** (Leaf: imports nothing.)
  - `packages/core` — **pure domain** (the `Room` aggregate + `Message`) + application use-cases + ports. **Must not import** Prisma, Redis, Next, or Socket.IO. Imports only `contracts`.
  - `packages/db` — Prisma client + repositories implementing core ports.
  - `packages/cache` — Redis: snapshots, locks, presence, rate limiter, adapter/emitter.
  - `packages/config`, `packages/observability`.
- **Dependency rule enforced in CI** (lint-level import restrictions — the V2 analogue of V1's architecture tests). The pure core staying pure is a hard requirement.
- **Feature-based UI structure.** Under `apps/web/src/features/<feature>/` with `components · hooks · services · store · types`. Features: `room · playback · queue · chat · participants`.
- **Clear separation of UI and business logic:**
  - Pages/routes **compose**, they contain no logic.
  - All network access lives in **services** (REST + Socket.IO).
  - State lives in **stores** (Zustand); **no network calls in stores**.
  - Business logic lives in **hooks/use-cases**, not components.
  - The local player is **reconciled** to server state, **never** treated as canonical.
- **Both entrypoints call the same use-cases.** REST handlers and Socket.IO handlers invoke shared `core` use-cases — never duplicate business logic across transports.
- **Two DB roles.** Migrations run as a privileged role in a deploy step (`prisma migrate deploy`); the runtime role is **DML-only**. Never auto-migrate from app instances.
- **One realtime namespace, room-scoped** by `room:{roomId}`. Redis adapter wired from day one; sticky sessions at the proxy.

---

# Realtime Rules

Full spec: `REALTIME_ENGINE.md`. Mandatory rules:

- **The server is the source of truth.** Redis mirrors committed Postgres state; clients reconcile to it. Redis must never hold the only copy of anything that matters.
- **Clients never become playback authority.** Only the host *drives* the server (their actions become commands); guests *follow*. The server holds the canonical anchor.
- **Playback state must be deterministic.** Given the anchor `{position, status, anchorAt, revision}` and the server clock, every client computes the same expected position. No client-side guessing.
- **Realtime events must be idempotent.** Duplicate/out-of-order delivery is normal (retries, dual paths). Enforce convergence:
  - **Playback:** reject any update with `revision ≤ local`; auto-advance only acts **if the ended item is still current**; guard cross-instance advance with a Redis `SET NX` lock.
  - **Queue:** merge incoming items **by id**; a late snapshot must not clobber a just-added item.
  - **Chat:** dedupe **by message id**.
  - **Presence:** key by `sessionId`; join/online events are convergent, not additive.
- **Identity is bound at the handshake from the session cookie — never from a payload.** Authority (host-only actions) is checked in the domain per command.
- **Commands are acknowledged and retryable (at-least-once); broadcasts are reconcilable.** A missed broadcast is healed by the snapshot re-pull on the next (re)connect.
- **Disconnect ≠ leave.** A drop opens a reconnect grace window (~30 s); it must **not** remove the participant or move the host. Finalize/fail-over only on grace expiry.
- **Lean live payloads, complete snapshots.** Live `playback:stateChanged` omits the resolved track (clients resolve from the queue); REST/`requestState` snapshots carry the full track.
- **Multi-room:** every broadcast carries `roomId`; a socket only receives events for rooms it has joined; identity is per `(roomId, sessionId)`.
- **Subscribe before fetching the snapshot; re-subscribe and re-pull on reconnect.** Unsubscribe the *specific* handler, never all handlers for an event on the shared socket.

---

# Playback Synchronization Rules

Full spec: `PLAYBACK_ENGINE.md`. This is the product's crown jewel; treat these as inviolable.

## MUST
- **MUST** keep a single server-authoritative anchor per room: `{ currentItemId, positionMs (P), status, anchorAt (T, server epoch ms), durationMs, revision }`.
- **MUST** preserve the **banking invariant**: `positionMs` is always the true offset *at* `anchorAt`. Play/Pause bank elapsed time; Seek replaces; track-change resets to 0.
- **MUST** compute live position as `expected = isPlaying ? P + (serverNow − T) : P`.
- **MUST** estimate the client clock **offset** via NTP-style probe (best of N by min-RTT), smooth it (EWMA), and detect clock jumps (step → reset + hard resync).
- **MUST** use **two-tier drift correction**: smooth (continuous micro-rate nudge where the provider supports it) for small drift; hard seek only for discontinuities.
- **MUST** use **predictive, latency-compensated seeks**: seek to `expected(serverNow + L)` where `L` is measured per client, so seeks land in-sync, not late.
- **MUST** treat these as **hard-sync** conditions (immediate predictive correction): play↔pause change, track change, explicit seek, `|drift| > 1000 ms`, reconnect, clock-jump.
- **MUST** make join-in-progress: snapshot → clock burst (before any seek) → predictive load+seek → one confirm-seek on ready.
- **MUST** keep auto-advance idempotent with two convergent paths (server timer authority + host `ENDED` accelerator); drain to **Idle** (room stays open) when the queue empties.
- **MUST** resume from the banked position on play; **MUST** correct duration when the real value is known (and broadcast the correction to all clients).

## MUST NEVER
- **NEVER** let a client's local player clock be authoritative.
- **NEVER** seek on every small drift (causes audible "thrash") — respect the in-sync dead-band (±150 ms), the seek cooldown (~2 s), and the host-action grace (~2.5 s).
- **NEVER** correct against player readings while buffering/seeking/unstarted/cued.
- **NEVER** store the continuously-moving position (it is computed; only state *transitions* are written).
- **NEVER** let guests drive the server or fight an in-flight host command.
- **NEVER** apply a stale playback update (`revision ≤ local`).
- **NEVER** double-advance on duplicate end signals.
- **NEVER** proxy/re-stream provider audio — embed the provider player; sync control + position only.

---

# Performance Requirements

Target KPIs (validate with tests/load tests — do not just assert them).

| KPI | Target |
|-----|--------|
| **Room join latency** (join → listening) | **< 2 s**, excluding provider buffering. |
| **Steady-state sync drift** (between any two listeners) | target **±150 ms**; **hard ceiling < 1 s**. |
| **Playback command propagation** (host action → guests applied) | **< 250 ms** in-region. |
| **Queue update latency** (add/remove/reorder → all clients) | **< 250 ms** in-region. |
| **Reconnection** | auto-reconnect backoff start ~0.5 s (cap 10 s, jittered); identity preserved within ~30 s grace; full resync on reconnect. |
| **Drift thresholds** | in-sync ±150 ms · soft 150–1000 ms · hard > 1000 ms · seek cooldown ~2 s · host re-anchor ≥ 500 ms · reconcile tick 250 ms · clock probe 10 s. |
| **Capacity** | **50 concurrent participants per room** without functional degradation. |

All thresholds are **runtime-configurable** (`packages/config`), never baked at build time.

---

# Database Rules

Full spec: `DATABASE.md`. Deciding question for any datum: **"If Redis is wiped right now, is anything lost?"** Yes → Postgres. Rebuildable/connection-scoped → Redis.

## Lives in PostgreSQL (durable source of truth)
- **Rooms** (incl. the embedded playback anchor `pb_*`), **Participants** (composite PK `(roomId, sessionId)`), **Tracks** (resolved-metadata catalog), **Queue Items**, **Chat Messages** (soft-delete), **Sessions** (the cookie value *is* `sessions.id`), **Users** (optional/future accounts — guests have none).
- The playback anchor is Postgres-resident so a restart never loses a playing room. Only state *transitions* are written; the moving position is computed.

## Lives in Redis (ephemeral / accelerator / coordination)
- Read-through **snapshots** (playback/queue/participants), **presence** (connection ref-counts; handles multi-tab), **locks** (advance + leader), **rate-limit counters**, **code→room** lookup, short-TTL **metadata** and **session-auth** caches, and the **Socket.IO adapter** pub/sub.

## Caching strategy
- **Read-through** (miss → Postgres → re-warm) and **invalidate/update-on-write**. Write commits to Postgres **first**, then update/invalidate Redis. Redis always lags-or-matches committed Postgres, never leads it.
- Graceful degradation: with Redis absent, serve from Postgres on a single instance. The adapter is the one Redis dependency *required* for multi-instance realtime correctness.

## Persistence strategy
- Each command runs in **one transaction** (load aggregate → mutate → persist); broadcast + cache invalidation happen **post-commit** (event emitted iff the write commits).
- Optimistic concurrency on `rooms` via an integer `version` (distinct from the client-facing `pb_revision`).
- Retention: idle rooms auto-close; closed rooms purged after a TTL (cascade); sessions expire after ~30 days inactivity; tracks GC'd when unreferenced and stale.

---

# Coding Standards

## TypeScript
- `strict: true`. No `any` (use `unknown` + zod/narrowing). No non-null `!` without justification. No `@ts-ignore`/`@ts-expect-error` without a comment explaining why.
- Validate **all external input** (REST bodies, socket payloads) with **zod schemas from `packages/contracts`** at the boundary. Internal code trusts validated types.
- Errors use a typed **`Result<T>`** envelope `{ ok: true, data } | { ok: false, error: { code, type, message, retryAfterMs? } }` with the shared error catalog; the domain throws typed domain errors caught by the application layer.
- The domain takes the clock as a parameter (`now: Date`); **never** call `Date.now()`/`new Date()` inside domain logic.

## Naming conventions
- **Files:** kebab-case (`playback-store.ts`, `add-track.ts`). React components: PascalCase file matching the component (`PlayerCard.tsx`).
- **Types/interfaces/classes/Prisma models:** PascalCase. **Variables/functions:** camelCase. **Constants:** UPPER_SNAKE_CASE.
- **Wire JSON:** camelCase. **DB tables/columns:** snake_case + plural (via Prisma `@@map`/`@map`).
- **Realtime events:** `domain:thing` (commands imperative: `playback:play`; broadcasts past-tense: `playback:stateChanged`).

## Folder structure (canonical)
```
apps/web/        Next.js: app/ (routes + api/) , src/features/<feature>/{components,hooks,services,store,types}
apps/realtime/   Socket.IO gateway + src/workers/
packages/contracts | core | db | cache | config | observability
```

## Error handling
- Never throw raw errors across a transport boundary; map to the typed catalog (HTTP status for REST, error ack for socket).
- Never swallow errors silently; log with context and return a typed error.
- All failures must leave shared state consistent (transactional writes; idempotent retries).

## Logging
- **Structured logging only** (no `console.log` in non-debug paths). Include correlation id, `roomId`, `sessionId` where relevant.
- **Never log secrets or session tokens.** The only permitted PII is the nickname (NFR-7). Do not log message bodies in production by default.
- Use levels deliberately: `error` (action needed), `warn` (recoverable anomaly), `info` (lifecycle), `debug` (dev only).

---

# Development Workflow

## Implementing a new feature
1. **Read the docs first** (this file → `SPEC.md` for behavior → the relevant engine/architecture doc). Confirm the feature's acceptance criteria in `SPEC.md`.
2. **Define/extend the contract** in `packages/contracts` (DTOs, zod, events, error codes) — this is the first code change.
3. **Implement the domain/use-case** in `packages/core` (pure, unit-tested with an injected clock). Add invariants to the aggregate.
4. **Implement adapters** (`db` repository, `cache`) behind the core ports.
5. **Wire the entrypoint** (REST handler and/or Socket.IO handler) calling the shared use-case.
6. **Implement the UI** (service → store → hook → component), reconciling to server state.
7. **Test:** domain unit tests, use-case tests against in-memory ports, integration tests (real Postgres + Redis), and the relevant acceptance criteria.

## Documenting architecture decisions
- Significant decisions are recorded as a row in `ARCHITECTURE.md` §14 (Decision Log): **Decision · V1 lesson · V2 choice · Rationale**. Use an ADR file for larger changes.
- When you make a new mistake (or fix one), append it to `LESSONS_LEARNED.md` in the **Problem → Root Cause → Solution → Prevention** format.

## Updating specifications
- Behavior change → update `SPEC.md` (and its acceptance criteria) **in the same change** as the code.
- Structure change → update `ARCHITECTURE.md`. Sync change → `PLAYBACK_ENGINE.md`. Event change → `REALTIME_ENGINE.md`. Schema change → `DATABASE.md`.
- Keep this `CLAUDE.md` in sync when a rule changes. **Code and docs ship together** — a PR that changes behavior without updating the spec is incomplete.

## Definition of done
Behavior matches `SPEC.md` · tests pass (unit + integration + acceptance) · contract types updated · docs updated · no dependency-rule violations · observability hooks present · no hardcoded environment values.

---

# Anti-Patterns (forbidden — these are V1's scars)

Do **not** reintroduce any of these. Each maps to a documented V1 lesson (`LESSONS_LEARNED.md`).

- **Host-authoritative playback** as the canonical truth. The *server* is authoritative; the host only drives it. (L-4, L-5)
- **Continuous seek loops / seek-on-every-drift.** Causes audible thrash. Use the two-tier corrector with dead-band + cooldown. (L-4.2)
- **Hardcoded/baked localhost URLs** (or any build-time environment config). Use same-origin relative URLs + runtime config. (L-7.1, L-8.1, L-10.1)
- **Realtime state duplication / Redis-as-truth.** Don't let a broadcast or cache become canonical; reconcile to Postgres-backed state. (L-2.4, M3)
- **Tight coupling between UI and the playback/sync engine.** The player is reconciled to server state behind a thin adapter; components don't own sync logic. (Core Principle 5)
- **Trusting client-supplied identity** (e.g., `sessionId` in a payload). Bind at the handshake. (L-6.1)
- **Failing over the host on a transient disconnect.** Grace window first. (L-5.1)
- **Cross-language / hand-kept duplicate types.** One shared contract package. (L-1.1)
- **Non-idempotent handlers** / double-advancing on duplicate signals. (L-2.4)
- **`youtube-nocookie.com` host, autoplay-on-load without a gesture, or proxying audio.** (L-3.2, L-3.4, L-3.5)
- **Over-engineering for hypothetical scale** (e.g., a message broker the product doesn't need). Build the seam, not the broker. (L-1.2)
- **Auto-migrating from app instances / running DDL as the runtime DB user.** Two roles, deploy-step migrations. (L-9.1, L-7.4)
- **Deferring observability, contract docs, API tests, and load tests** to "later." They're part of done. (L-11)

---

# AI Collaboration Rules

When you (Claude) write code for this project:

- **Always read `PROJECT_KNOWLEDGE.md`** (V1 truth) and this `CLAUDE.md` before substantive work; consult the specific design doc for the subsystem you're touching.
- **Always follow `SPEC.md`** for behavior and **`ARCHITECTURE.md`** for structure. They are authoritative within their domains.
- **Never introduce architecture that conflicts with existing decisions** (`ARCHITECTURE.md` §14 Decision Log). If a decision genuinely needs changing, propose it explicitly, record the rationale, and update the docs — don't silently diverge.
- **Prefer consistency over novelty.** Match existing patterns, naming, and idioms. Don't add a second way to do something that already has a way.
- **Keep the domain pure** (`packages/core` imports only `contracts`); put all infrastructure behind ports.
- **Update the contract first**, then implementation, then UI; ship code + tests + docs together.
- **When unsure about behavior, check `SPEC.md`'s acceptance criteria** rather than guessing; when unsure about sync, check `PLAYBACK_ENGINE.md`.
- **Flag assumptions explicitly.** Never invent business requirements; if information is missing, state the assumption and proceed with the safest default, or ask.
- **Respect the anti-patterns list** — reintroducing a V1 scar is never acceptable, even if it's simpler.
- **Verify, don't assert.** If you claim something works (tests pass, drift within target), it must be actually checked.

---

# Future Vision

The long-term roadmap (post-MVP; do not build ahead of need, but keep the design additive toward these):

- **Scalable realtime rooms.** Harden multi-instance fan-out (Redis adapter is in from day one); move presence + code lookup fully into Redis; load-test and tune to and beyond 50 participants; consider extracting a hot bounded context (Chat or Playback) into its own service consuming the same contract.
- **Spotify-grade synchronization.** Tighten steady-state drift via adaptive thresholds (auto-tuned from client-reported drift telemetry) and provider adapters that support continuous rate control.
- **Spotify integration (full).** First-class Spotify playback alongside YouTube, behind the same player-adapter seam.
- **Playlists & history.** Saved queues, room history, "up next," queue voting/reorder UI, co-hosts.
- **Social features.** Richer chat (reactions/replies, light moderation), and eventually optional accounts/identity ("reclaim host," saved rooms) layered on the existing session model — keeping the guest no-auth fast path intact.
- **Mobile apps.** Native clients reusing the shared contract and the same server-authoritative sync engine.
- **Discovery & more sources.** SoundCloud/Apple Music, and (much later) AI recommendations / auto-DJ.

---

*This file is the permanent operating manual for MMMuzik V2. Keep it accurate: when a rule changes, change it here and in the owning design doc in the same PR. A new Claude session should be able to read this top-to-bottom and contribute correctly without any prior conversation context.*
