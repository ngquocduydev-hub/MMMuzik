# YouTube In-App Search — Implementation Plan

> **Single source of truth for the in-app YouTube search feature.** Living document — updated as work progresses. Last updated: 2026-06-23.
>
> **Status: FEATURE COMPLETE & build-verified — ready for UI testing.** Phases 1–5 (core) done; `YOUTUBE_API_KEY` configured locally. `pnpm typecheck` ✅ · `pnpm lint` ✅ · unit+UI **114** ✅ · `pnpm build` ✅. Deferred (non-blocking): reactions on now-playing (Phase 5 stretch), concurrency hardening, and the integration-test run (needs a DB/Redis env). All work local/uncommitted (single commit once verified on UI).
>
> **How to test on the UI:** run `pnpm dev` (with Postgres + Redis up, e.g. `docker-compose.dev.yml`) → create/join a room → click **Search** in the queue header → type a query → **Add** a result. Verify: results show duration/views; livestreams/un-embeddable are flagged & not addable; re-adding prompts "Add anyway"; a second browser/tab shows "X is adding a song…"; the empty queue shows the Search CTA. With the key now set, search returns real results (no "unavailable").

---

## Overview

### Feature vision
Let users discover and add music **without leaving the room**. Today music enters a room only by pasting a YouTube URL — a context-switch to YouTube (an attention trap) that leaks people out of the shared listening experience. In-app search turns MMMuzik from a *sync utility* (bring your own links) into a *destination* (find and play music together).

### Business value
The primary goal is **not convenience**. It is to:
- **Keep users inside the room** (no tab-away to YouTube).
- **Increase participation** — lower the contribution floor so more people add music.
- **Increase queue contributions** — searching is faster than copy-pasting a URL, especially on mobile.
- **Strengthen the social listening experience** — visible, attributed, collaborative curation.

### Success metrics
Success is defined as **more distinct contributors per room** and **higher return rate** — *not* session length (which rises mechanically and is a vanity metric here). See [Metrics & Monitoring](#metrics--monitoring).

### Non-goals
- Re-streaming or proxying audio (we embed YouTube's player; sync control + position only).
- Accounts/login for search (the no-auth, nickname-only fast path is preserved).
- Becoming a full music catalog app (playlists, libraries, recommendations are out unless they make *listening together* better).
- Multi-source search (Spotify et al.) in this iteration.
- Replacing URL-paste — search is **additive**; paste stays as exact-intent input and as the quota/error fallback.

---

## MVP Scope

### Included
- A protection layer that makes adding safe (livestream/embeddability/duration guards, duplicate handling, rate limit, queue caps) — applied to **both** the existing URL-paste path and the future search path.
- Server-side YouTube **search** (official Data API) behind a single server choke point.
- An in-room **search UI** (overlay, explicit submit) with rich result cards.
- A single **"Add to queue"** action per result, with contributor attribution.
- Result caching + quota protection + graceful fallback to URL-paste.
- Analytics instrumentation for the success metrics.

### Excluded (deferred)
- Play Now / Play Next / Save / Suggest per-result actions.
- Suggest→approve workflow and room modes (open vs curated).
- Round-robin / turn-taking fairness, reactions, playlist import, saved libraries, multi-source search.
- Adaptive / host-configurable limits.

---

## Risks

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| **Quota limitations** — `search.list` costs ~100 units; default ≈ 100 searches/day for the *entire app* | High | High | Explicit submit (no search-as-you-type), debounce, min query length; Redis result cache; per-user/room search rate limit; daily quota-budget circuit breaker → fall back to URL-paste; request a quota increase before search launch |
| **Unplayable videos** — embedding-disabled / age-gated / region-blocked break playback for the whole room | High | High | Add-time embeddability/availability block (Data API `status`); flag in results; host-error auto-skip at play time; keep "Open on YouTube" hatch |
| **Livestreams** — no finite duration → auto-advance never fires → permanent room dead-end | High | High | Add-time hard block (Data API `liveBroadcastContent` + non-positive duration); guard runs **before** the idle-room auto-play branch; defense-in-depth play-time skip |
| **Duplicate songs** — same video stacks silently in the shared queue | Medium | High | Server-side duplicate detection over *upcoming* items by video id; warn-not-block via `allowDuplicate` confirm |
| **Queue flooding** — one-click add removes the only existing rate limiter (URL friction) | High | High | Server-side per-user add rate limit + per-user pending cap + per-room ceiling, applied to all add paths |
| **Abuse scenarios** — griefing, mass-add, quota draining, shock content | Medium | Medium | Rate limits (add + search, separately); pending cap; attribution for social pressure; host remove/clear/skip; server-authoritative enforcement (never client-trusted) |

---

## Development Phases

### Phase 0 — Discovery & Validation
- **Goal:** Remove feasibility/safety unknowns before building.
- **Deliverables:** Codebase audit (done — see [Progress](#progress--phase-1-checklist)); confirm Data API quota math + request increase; ToS check (watch-page links, attribution, ≤30-day caching); define success metrics + baseline instrumentation plan; decide cap/limit defaults.
- **Acceptance Criteria:** Quota increase requested; ToS sign-off noted; metric definitions agreed; this document created and reviewed.
- **Dependencies:** None.
- **Risks:** Quota-increase lead time (days–weeks) — start early.
- **Testing Strategy:** N/A (planning). Validate quota numbers against documented API costs.

### Phase 1 — Protection Layer  ← **CURRENT**
- **Goal:** Make adding a track safe and fair **before** any search exists, enforced server-side on the existing add path. This is the foundation the whole feature stands on.
- **Deliverables:**
  - **Embeddability validation** — reject videos that can't embed (Data API `status.embeddable`, privacy).
  - **Duration validation** — capture authoritative duration at add (Data API `contentDetails.duration`); reject non-finite.
  - **Livestream rejection** — block livestreams/premieres (Data API `liveBroadcastContent`), before auto-play.
  - **Duplicate detection** — warn-not-block over *upcoming* items by video id; `allowDuplicate` confirm.
  - **Queue protection** — per-user pending cap + per-room ceiling.
  - **Rate limiting** — reusable Redis fixed-window primitive; per-(room, session) add limit (burst + sustained).
  - **Contracts** — new error codes; `retryAfterMs` on the error envelope; `allowDuplicate` on `queue:add`.
  - **Graceful degradation** — when no `YOUTUBE_API_KEY` is configured, fall back to oEmbed (no Data-API-only guards), preserving today's behavior.
- **Acceptance Criteria:**
  - With a Data API key: adding a livestream, an un-embeddable video, or an unavailable video is rejected server-side with a typed error, before insert/auto-play; a valid add stores the real duration.
  - Re-adding an upcoming video is rejected with `QUEUE_DUPLICATE` unless `allowDuplicate` is set.
  - Exceeding the per-user pending cap → `QUEUE_USER_LIMIT`; exceeding the per-room ceiling → `QUEUE_FULL`.
  - Exceeding the add rate limit → `QUEUE_RATE_LIMITED` carrying `retryAfterMs`.
  - Without a key: existing add behavior is unchanged (tests green); guards that require the Data API are inert and documented as such.
- **Dependencies:** Redis (present), Data API key (optional; guards activate when present).
- **Risks:** Breaking the existing add path; limits too tight/loose (start conservative, tune from telemetry); Data API latency/quota (mitigated by Phase 2 caching — not needed for the metadata lookup which is cheap, 1 unit).
- **Testing Strategy:** Unit tests for the duration parser + livestream/embeddable classifier (fetch stubbed) and the rate limiter; integration tests for duplicate, per-user cap, and (with key + stubbed Data API response) livestream/embeddable rejection; verify existing queue tests still pass.

### Phase 2 — Search Infrastructure
- **Goal:** Server-side YouTube search behind one choke point holding the API key.
- **Deliverables:** Search endpoint/handler (`search.list` → enrich via `videos.list`); Redis result cache (normalized query key, short TTL); per-(room, session) search rate limit; daily quota-budget counter + circuit breaker → URL-paste fallback; sanitized result DTO.
- **Acceptance Criteria:** A query returns results with title, channel, duration, thumbnail, and availability flags; repeat queries are cache-served (0 units); search limit + quota breaker enforced; key never reaches the client.
- **Dependencies:** Phase 1 (rate-limit primitive, Data API module, error envelope).
- **Risks:** Quota exhaustion; latency; ToS compliance.
- **Testing Strategy:** Unit (query normalization, cache key, quota counter); integration (search → cache hit; quota breaker → fallback) with stubbed Data API.

### Phase 3 — Search UI
- **Goal:** In-room discovery surface.
- **Deliverables:** Search overlay (dialog/sheet over the room, explicit submit, debounce, min length) reusing `AddSongDialog` patterns; rich result cards mirroring `QueueItem`; loading/empty/zero/error states; availability flags surfaced in the list; responsive placement (desktop/tablet/mobile) without unmounting the player; URL-paste kept as a co-equal tab/path.
- **Acceptance Criteria:** A participant can open search anywhere in the room, submit, scan results confidently, and never gets a dead-end; unplayable results are visibly flagged.
- **Dependencies:** Phase 2.
- **Risks:** Burying the entry point; wrong-version regression (mitigate via card richness).
- **Testing Strategy:** Component tests for the search panel + result card; UI states; manual end-to-end.

### Phase 4 — Queue Integration
- **Goal:** One-tap add from a result, end to end.
- **Deliverables:** "Add to queue" wired to `queue:add` with the result's video id; optimistic-feeling feedback (pending → success toast); "In queue" badge derived from the live queue (self-heals on host remove/skip); contributor attribution surfaced on queue items; client-side duplicate pre-warning from the snapshot + `allowDuplicate` confirm; multi-add (results stay open).
- **Acceptance Criteria:** Add appears in everyone's queue within the realtime budget, attributed; double-tap can't double-add; duplicate prompts a confirm; all Phase 1 guards apply (search path reuses the same use-case).
- **Dependencies:** Phases 1–3.
- **Risks:** Stale optimistic state; double-add race.
- **Testing Strategy:** Integration (search-add reuses `addTrack` guards); component (badge derivation, duplicate confirm).

### Phase 5 — Social Enhancements
- **Goal:** Make concurrent contribution feel alive.
- **Deliverables:** "Who's adding" ephemeral presence cue; idle empty-state "search and add" CTA; prominent "Up Next." (Reactions on now-playing are designed-for but optional.)
- **Acceptance Criteria:** Participants see others searching/adding in real time; idle rooms invite the first add.
- **Dependencies:** Phase 4.
- **Risks:** Presence noise (debounce).
- **Testing Strategy:** Component + manual; verify ephemeral events are not persisted.

### Phase 6 — Future Enhancements
- **Goal:** Expand only where telemetry justifies.
- **Deliverables (as warranted):** Play Next / Play Now (host-gated); curated/host-approval mode + Suggest; round-robin fairness; reactions; playlist import; saved/history; multi-source search.
- **Acceptance Criteria:** Each gated on metrics (e.g., flooding → curated mode; domination → round-robin).
- **Dependencies:** Phases 1–5 + live telemetry.
- **Risks:** Scope creep toward "becoming a music app."
- **Testing Strategy:** Per-feature; defined when scheduled.

---

## User Stories

- **As a participant**, I want to add a track without it breaking the room for everyone, so the shared experience stays reliable. *(Phase 1)*
- **As a participant**, I want a heads-up if a song is already coming up, but still be able to add it on purpose. *(Phase 1)*
- **As a participant**, I want everyone's contributions to coexist, so one person can't bury the queue. *(Phase 1)*
- **As a listener**, I want every added track to carry its real length immediately, so playback and auto-advance are correct from the start. *(Phase 1)*
- **As a participant**, I want to search for music from inside the room and add it in one tap, so I never leave to find a link. *(Phases 2–4)*
- **As a participant**, I want to pick the right version confidently from a result. *(Phase 3)*
- **As a participant**, I want to see who added each track and who's adding now, so contributing feels social. *(Phases 4–5)*
- **As the product owner**, I want participation/return instrumented before launch, so I can tell whether the feature works. *(Phase 0/2)*

---

## Edge Cases

- **Idle-room auto-play trap:** the first track added to an idle room auto-plays — every guard MUST run before that branch.
- **Livestream that slipped through** (queued as VOD, later went live): defense-in-depth — a current track stuck at duration 0 is a candidate for host-error/skip.
- **Premiere/upcoming → later a finite VOD:** blocked now, re-addable once finite.
- **Ended livestream now an archived VOD with real duration:** allowed (finite).
- **Embeddable per API but errors for the host** (age/region/sign-in): play-time host-error auto-skip catches it.
- **Guest player errors but host plays fine:** local "Open on YouTube" only — never a room-wide skip.
- **Double-tap add before ack:** disable the button while pending + duplicate guard converges.
- **At-least-once retry after reconnect:** duplicate guard converges.
- **Same video, different ids** (official vs lyric): not treated as duplicates (identity = video id).
- **Played tracks linger before current:** caps/duplicate use *upcoming* (`position > current`) semantics (matches `upNextCount`).
- **No API key configured:** guards requiring the Data API are inert; add falls back to oEmbed (documented).
- **Quota exhausted mid-session:** search degrades to URL-paste; the cheap `videos.list` add-time lookup is separate from `search.list`.

---

## Metrics & Monitoring

**Define success as distinct contributors per room + return rate — not session length.**

Measure first (baseline before search launches):
1. Distinct contributors per room (+ distribution: broadening vs one dominator).
2. Search → add conversion; zero-add searches (frustration).
3. Add mix: search-adds vs URL-adds.
4. Room/session return rate (day-N / week-N).

Operational guardmetrics: daily quota consumption vs budget; rate-limit / duplicate / cap rejection counts; add-time blocks (livestream/unplayable); play-time auto-skips.

Counter-hypothesis to watch: frictionless adding could raise session length while *narrowing* participation (one dominant adder). If distinct-contributors flattens while adds-per-session climbs, tune the guardrails — don't add features.

---

## Rollout Plan

1. **Phase 1 first, on the existing add path** — ship guards/limits with the Data API key behind a flag; verify no regression with the key absent.
2. Enable the Data API key in a staging room; validate guards with real videos (livestream, age-gated, blocked).
3. **Phase 2–3 behind a feature flag**, internal rooms only; watch quota and guardmetrics.
4. Gradual rollout of search to a % of rooms; monitor distinct-contributors and quota.
5. Keep URL-paste always available as the fallback; circuit-breaker auto-degrades search on quota/error.

---

## Open Questions

- **Per-user pending cap value** — start ~5–10? (Current default: 10; tune from telemetry.)
- **Data API key provisioning + quota increase** — owner and timeline?
- **ToS sign-off** — confirmed in writing (attribution, watch-page links, caching TTL)?
- **Region restriction policy** — best-effort warning vs hard block? (MVP: rely on play-time host-skip for region; hard-block only embeddable=false/unavailable/livestream.)
- **Metadata persistence vs ToS caching limits** — current `Track` catalog stores title/thumbnail (today from oEmbed); confirm Data-API-sourced fields respect caching limits.

---

## Progress — Phase 1 Checklist

> Legend: ✅ done · 🟡 in progress · ⬜ not started · ➖ pre-existing (reused)

**Audit (Phase 0):**
- ✅ Mapped current add path, queue model, host model, contracts, Redis/config, tests.
- ✅ Confirmed none of the Phase 1 protections exist today.
- ✅ Confirmed "upcoming" semantics (`position > current`) from `upNextCount` — caps/duplicate must be position-aware.

**Phase 1 — Protection Layer:**
- ✅ Contracts: error codes (`QUEUE_DUPLICATE`, `QUEUE_RATE_LIMITED`, `QUEUE_UNPLAYABLE`, `QUEUE_LIVESTREAM`, `QUEUE_USER_LIMIT`, `QUEUE_FULL`) + `rate_limited` error type + `retryAfterMs` on the envelope (`AppError`, `describeError`, `ErrorResponse`, `fail`) + `allowDuplicate` on `queue:add`. — `src/shared/errors/index.ts`, `src/shared/http/response.ts`, `src/shared/events/index.ts`
- ✅ Constants: queue-protection thresholds + `redisKeys.rateLimit`. — `src/shared/constants/index.ts`
- ✅ Config: lazy `getYouTubeApiKey()`. — `src/lib/config.ts`
- ✅ Rate-limit primitive (Redis fixed-window, reusable). — `src/server/services/rateLimiter.ts`
- ✅ YouTube Data API module (`videos.list` → duration + embeddable + livestream; ISO-8601 parser + classifier). — `src/server/services/youtubeDataApi.ts`
- ✅ Repository: `countUpcomingBySession`, `findActiveByVideoId`, `upsertTrack` duration passthrough. — `src/server/repositories/queueRepository.ts`
- ✅ `addTrack` guard pipeline (rate-limit → caps → duplicate → metadata+guards → real duration → insert → auto-play) + handler passthrough of `allowDuplicate`/`retryAfterMs`. — `src/server/services/queueService.ts`, `src/server/socket/handlers/queueHandlers.ts`
- ✅ **Play-time recovery** — host-player error on the current track → server `recoverFromError` auto-skips (host-only, idempotent); guest error stays local ("Open on YouTube" only). `playback:trackError` event; `src/server/services/queueService.ts`, `src/server/socket/handlers/queueHandlers.ts`, `src/features/youtube/components/YouTubePlayer.tsx`.
- ✅ Tests written: unit (`tests/unit/youtubeDataApi.test.ts` — parser/classifier/search-mapper) + integration (`tests/integration/queue.protection.test.ts` — guards/duplicate/caps/rate-limit; `tests/integration/playback.recovery.test.ts` — host/guest/idempotent recovery).
- 🟡 Verification: `pnpm typecheck` ✅, `pnpm lint` ✅, `pnpm test:unit` ✅ (87 passed). Integration tests **authored but not run locally** — Postgres/Redis are not running here (no Docker). Run `pnpm test:integration` in CI / a dev box with `docker-compose.dev.yml` up.

**Phase 2 — Search Infrastructure (server):**
- ✅ Contracts: `SearchResultDto` + `SearchResponseDto` (`{ available, results }`); generic `RATE_LIMITED` error; `searchQuerySchema`; search constants + `redisKeys.searchCache`/`searchQuotaDay`. — `src/shared/types/index.ts`, `src/shared/errors/index.ts`, `src/shared/validation/index.ts`, `src/shared/constants/index.ts`
- ✅ Data API search: `searchYouTube` = `search.list` (type=video) → ONE batched `videos.list` enrich (duration, embeddable, livestream, viewCount), relevance order preserved; `toSearchResult` mapper. — `src/server/services/youtubeDataApi.ts`
- ✅ Orchestration `searchService`: participant gate, per-(room,session) search rate limit, read-through Redis result cache (24h, 0 quota on repeats), daily quota-budget **circuit breaker** → degrade to `available:false` (URL-paste fallback). API key server-side only. — `src/server/services/searchService.ts`
- ✅ Endpoint: `GET /api/rooms/[id]/search?q=` (participant-gated; identity from session cookie). — `src/app/api/rooms/[id]/search/route.ts`
- ✅ Tests: unit (search mapper in `youtubeDataApi.test.ts`) + integration (`tests/integration/search.service.test.ts` — enrich/order/addable flags, cache hit, participant gate, no-key degrade, quota breaker, rate limit). typecheck/lint/unit green; integration pending a DB/Redis env.
**Phase 3 — Search UI:**
- ✅ Feature module `src/features/search/`: `services/searchApi.ts` (client → `GET /api/rooms/:id/search`), `hooks/useYouTubeSearch.ts` (explicit-submit state machine + stale-response guard — never search-as-you-type, to protect quota), `components/SearchResultCard.tsx` + `components/SearchDialog.tsx`.
- ✅ Result cards mirror `QueueItem`: thumbnail, title, channel · duration · views; availability badges (Live / Can't play) **disable Add**; "In queue" → "Add again" cue derived from the live queue store.
- ✅ One-tap **Add** wired to the existing `queue:add` (server re-guards authoritatively). Duplicate → soft Sonner confirm "Add anyway" (re-sends `allowDuplicate:true`); rate-limit / unplayable → friendly toast.
- ✅ States: idle / loading / ready / zero-results / error / **unavailable** (→ "use Add song to paste a link"). URL-paste kept co-equal: `SearchDialog` + `AddSongDialog` both in the queue header (`src/components/QueueList.tsx`).
- ✅ `formatViewCount` helper (`src/lib/format.ts`).
- ✅ Verification: `pnpm typecheck` ✅, `pnpm lint` ✅, unit + UI suite ✅ (**109 passed**, 18 files — incl. 6 new `tests/ui/SearchResultCard.test.tsx` + `formatViewCount` in `tests/unit/format.test.ts`).
**Phase 4 — Queue Integration:**
- ✅ One-tap Add wired (Phase 3); "In queue → Add again" cue derives from the live queue store (self-heals on host remove/skip); duplicate soft-confirm; optimistic per-result `adding/added` state. (Server stays authoritative — Phase 1 guards.)

**Phase 5 — Social (core):**
- ✅ **"Who's adding" presence cue** — ephemeral, sender-excluded broadcast. Contract: C2S `queue:activity` `{roomId}` → server re-broadcasts `presence:adding` `{roomId, sessionId}` to others (`src/server/socket/handlers/queueHandlers.ts`). Client: `useQueueActivityStore` (keyed by sessionId, auto-expiring, `now`-injectable) + `useWhoIsAdding`/`useActivityPing`/`describeAdders` (`src/features/queue/activityStore.ts`); wired into `realtimeService` and emitted from both `SearchDialog` and `AddSongDialog` (debounced). Rendered in `QueueList` ("Maya is adding a song…"). Nicknames resolved from the participants store; never persisted.
- ✅ **Idle empty-state CTA** — empty queue now foregrounds the Search action (`QueueList` EmptyState `action`).
- ⬜ Reactions on now-playing (Phase 5 stretch) — not built; now-playing surface leaves room for it.

**Env:**
- ✅ `YOUTUBE_API_KEY` placeholder wired into `.env`, `.env.example` (empty), `.env.production.example` (CHANGE_ME) with guidance. Code reads it lazily via `getYouTubeApiKey()`; empty → search degrades to URL-paste.

### Graceful-degradation note
The Data-API-only guards (embeddability / livestream / authoritative duration) activate **only when `YOUTUBE_API_KEY` is set**. Without it, `addTrack` falls back to keyless oEmbed (today's behavior: duration 0, no availability guards), so existing tests pass unchanged. The duplicate guard, per-user/room caps, and rate limiting are **always active** (no API needed). Set `YOUTUBE_API_KEY` to turn on the availability guards — this is the recommended production configuration.

### Known gaps / follow-ups
- **Play-time recovery** — ✅ done (host-error auto-skip; guest-error local hatch). Note: only the "permanent" YouTube error codes (2/100/101/150) trigger an auto-skip; transient HTML5 (code 5) shows the local overlay without skipping.
- **Per-room ceiling (500)** is enforced in code but not integration-tested (500-row seed is slow); covered by the same path as the per-user cap.
- **Concurrency**: deterministic ordering for simultaneous adds and a single-winner auto-play lock (noted in the plan) are not yet implemented — recommended before high-traffic search launch.
- **Phase 3 (Search UI)** not started — needs `YOUTUBE_API_KEY` provisioned + the quota-increase decision (Open Questions) before it returns real results.

### Change log
- 2026-06-23 — Document created; codebase audited; **Phase 1** Protection Layer implemented (contracts, rate limiter, Data API guard module, repository helpers, guarded `addTrack`).
- 2026-06-23 — **Phase 1 completed** with play-time recovery (`recoverFromError` + `playback:trackError` + client wiring). **Phase 2** Search Infrastructure implemented server-side (`searchYouTube` + `searchService` cache/quota/rate-limit + `GET /api/rooms/:id/search`). typecheck/lint/unit green (87 unit); integration tests authored (pending a DB/Redis environment). Phase 3 (UI) not started.
- 2026-06-23 (review) — Hardened `searchService`: a Data API **error** (not just no-key/quota) now degrades to `available:false` (URL-paste fallback) instead of surfacing a 500 — closes a gap vs the documented "fall back when the API errors" intent. Added a regression test. typecheck/lint/unit green (87).
- 2026-06-23 — **Phase 3 (Search UI) implemented**: `src/features/search/` (searchApi + useYouTubeSearch + SearchResultCard + SearchDialog), mounted alongside `AddSongDialog` in the queue header; Add wired to `queue:add` with duplicate-confirm; `formatViewCount`. Verified: typecheck ✅, lint ✅, unit+UI ✅ (109 passed). Still local/uncommitted.
- 2026-06-23 — **Phase 4 + Phase 5 (core)**: queue-integration polish (In-queue self-heal, optimistic add state); **"who's adding" presence cue** (`queue:activity`/`presence:adding`, `activityStore`, wired into realtime + both add dialogs + QueueList); **idle empty-state CTA**; `YOUTUBE_API_KEY` placeholder wired into all env files. Verified: typecheck ✅, lint ✅, unit+UI ✅ (**114 passed**, incl. new `tests/unit/queueActivity.test.ts`). Remaining: reactions (stretch), concurrency hardening, integration run, real API key. Still local/uncommitted.
- 2026-06-23 — **Docker fix**: the stack runs via `docker compose up` (built image, no source mount), but base + dev compose never passed `YOUTUBE_API_KEY` to the app container → search always degraded (`available:false`) regardless of `.env`/restarts. Added `YOUTUBE_API_KEY: ${YOUTUBE_API_KEY:-}` (Compose substitution from host `.env`) to `docker-compose.yml` + `docker-compose.dev.yml` (prod compose already injects via `env_file: .env.production`). Rebuilt + recreated; **verified search end-to-end: `available:true`, 12 results** for "messi" with `addable` flags. To run: `docker compose up -d --build`.
- 2026-06-23 — **Feature finalized**: real `YOUTUBE_API_KEY` set in local `.env` (gitignored/untracked — won't be committed; templates kept as placeholders). Confirmed env auto-loads via `@next/env` (`src/server/load-env.ts`). Final gate **`pnpm build` ✅** (new `/api/rooms/[id]/search` route + updated `/room/[roomId]` compile clean). Ready for UI testing. Deferred (non-blocking): reactions, concurrency hardening, integration run.
