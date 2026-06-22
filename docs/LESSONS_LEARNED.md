# LESSONS_LEARNED.md — MMMuzik V1 Engineering Retrospective

> **Purpose.** Preserve, in one place, every engineering lesson from building MMMuzik V1 so that V2 (and future engineers) do not repeat them. Each lesson is structured as **Problem → Root Cause → Solution → Prevention Strategy**.
>
> **Source of truth.** `PROJECT_KNOWLEDGE.md` (V1) — primarily §12 (Known Issues & Lessons Learned) and §13 (Future Improvements), plus lessons threaded through §4–§11 and §14.
>
> **Evidence labels (carried from the source — do not blur them):**
> - **`[fact]`** — confirmed by V1 code/behavior.
> - **`[fact: fixed]`** — a real bug that was diagnosed and fixed in V1.
> - **`[operational lesson]`** — follows from the code's mechanics but was **not** encoded in the repo (e.g., no Cloudflare/cache config exists in-tree). True, but inferred from how the system behaves, not from a committed artifact.
> - **`[gap]`** — designed-for but deferred in V1 (future work); the lesson is "don't defer this again."
>
> **How to use this.** Before designing or shipping any V2 subsystem, read the matching category. The **Prevention Strategy** of each lesson states the rule for V2, and where V2 already addresses it, a *V2 status* note points to the relevant design doc.

---

## Table of Contents

0. [Meta-Lessons (the recurring root causes)](#0-meta-lessons-the-recurring-root-causes)
1. [Architecture Mistakes](#1-architecture-mistakes)
2. [Realtime Synchronization Mistakes](#2-realtime-synchronization-mistakes)
3. [YouTube Integration Challenges](#3-youtube-integration-challenges)
4. [Playback Drift Issues](#4-playback-drift-issues)
5. [Host-Authority Problems](#5-host-authority-problems)
6. [SignalR Lessons](#6-signalr-lessons)
7. [Deployment Lessons](#7-deployment-lessons)
8. [Cloudflare Tunnel Lessons](#8-cloudflare-tunnel-lessons)
9. [Docker Lessons](#9-docker-lessons)
10. [Browser Caching Lessons](#10-browser-caching-lessons)
11. [Production-Readiness Lessons](#11-production-readiness-lessons)
12. [Top Rules for V2 (cheat sheet)](#12-top-rules-for-v2-cheat-sheet)

---

# 0. Meta-Lessons (the recurring root causes)

Most V1 pain traced back to a handful of repeating root causes. If you internalize only this section, you avoid the majority of the mistakes.

| Meta-lesson | Showed up as |
|-------------|--------------|
| **M1 — Origin-bound assumptions must change together.** Any move that changes the origin (LAN, tunnel, domain) breaks *every* origin-coupled setting at once: baked URLs, CORS allow-list, cookie `SameSite`. | Cloudflare tunnel (§8), localhost build (§7), browser cache (§10). |
| **M2 — Build-time configuration is a trap for anything environment-specific.** Baking URLs/secrets at build time means a config change requires a rebuild **and** a cache bust. | `NEXT_PUBLIC_*` baked URLs (§7), stale bundles (§10). |
| **M3 — Never trust the client's clock or its self-reported state as canonical.** | Playback drift (§4), the entire server-authoritative design (§4). |
| **M4 — Two languages / two repos breed contract drift.** Wire shapes silently diverge without a shared, compile-checked contract. | FE↔BE drift (§1.1). |
| **M5 — Transient ≠ terminal.** Treating a brief disconnect as a departure churns state. | Host failover on disconnect (§5), presence (§6). |
| **M6 — Idempotency is not optional in a distributed/realtime system.** Duplicate signals, retries, and dual paths are normal. | Auto-advance, consumers (§2). |
| **M7 — Bleeding-edge and newly-commercial dependencies carry hidden cost.** | .NET 10 reversion, MediatR v13 / FluentAssertions v8 licensing (§1.4). |
| **M8 — "Designed but deferred" is technical debt that bites at scale/launch.** | Redis backplane, observability export, API tests, auth (§11). |

---

# 1. Architecture Mistakes

### L-1.1 — Cross-language, two-repo contract drift `[fact]`
- **Problem.** Pervasive frontend↔backend wire-shape mismatches: hub calls missing `roomId`, `MessageReceived` vs `MessagePosted`, flat vs nested queue DTOs, create/join responses not matching the FE `Room` type, and the FE silently defaulting to `DEMO_MODE`. An integration review (2026-06-13) found this was systemic, not incidental.
- **Root Cause.** A C# backend and a TypeScript frontend in **separate repos** with **hand-maintained** DTOs on each side. Nothing forced the two to agree; drift accumulated invisibly until runtime.
- **Solution.** V1 ran a dedicated integration pass to realign the running FE to the backend contract (queue layout/state-sync, closed-room 404 gate, participant PK all landed afterward). The backend remained authoritative per SYSTEM_DESIGN.
- **Prevention Strategy.** Make the contract a **single shared, compile-checked artifact**. *V2 status:* one repo, end-to-end TypeScript, a `packages/contracts` package (zod→types + typed event maps) imported by client, web, and realtime — so any drift is a **compile error**, not a runtime surprise (ARCHITECTURE AD-1, REALTIME §4.1).

### L-1.2 — Over-built messaging seam for an MVP `[fact]`
- **Problem.** A RabbitMQ integration bus + transactional outbox added real operational weight (broker to run, DLQs to mind, `ACCESS_REFUSED` noise in dev) while the **in-process broadcast was always the primary, low-latency path**. The broker carried only projections/extraction value the MVP never used.
- **Root Cause.** Designing for a future "extract modules into services" goal *before* it was needed, paying its operational cost up front.
- **Solution.** V1 kept the broker but made it strictly the *durable/secondary* path; live UX never depended on it (a broker backlog couldn't block playback/chat).
- **Prevention Strategy.** Build the seam, not the broker, until extraction is real. *V2 status:* the broker is **removed**; Redis (adapter + emitter) handles fan-out and a clean bounded-context split keeps future extraction cheap. An outbox can return *if and when* cross-service durability is actually required (ARCHITECTURE AD-4).

### L-1.3 — Targeting a bleeding-edge framework version `[fact]`
- **Problem.** Early ADRs and the README targeted **.NET 10**; a later phase had to **revert the Dockerfile and target to net9.0**.
- **Root Cause.** Adopting a not-yet-stable/ubiquitous runtime version before the tooling/images settled.
- **Solution.** Reverted to net9.0 (confirmed by `Directory.Build.props` and the `sdk:9.0`/`aspnet:9.0` images); net9.0 treated as current truth.
- **Prevention Strategy.** Pin to the latest **stable, widely-available LTS/standard** runtime; adopt new majors deliberately, behind a spike, not as the default.

### L-1.4 — Dependency licensing/version traps `[fact]`
- **Problem.** Key libraries went commercial in newer majors: **MediatR v13+** and **FluentAssertions v8+**. Upgrading blindly would have introduced licensing cost/obligations.
- **Root Cause.** Popular OSS libraries changing license terms across majors; "always upgrade" instinct.
- **Solution.** V1 **pinned** to the last free/permissive versions (MediatR 12.x Apache line; FluentAssertions to the last MIT release).
- **Prevention Strategy.** Track license terms per dependency; pin majors; review license changes in dependency-update PRs. Prefer libraries with stable licensing — or thin abstractions you can swap (*V2 status:* MediatR's role is replaced by plain use-case functions, removing that exposure — ARCHITECTURE AD-8).

### L-1.5 — Keep domain logic framework-free (the decision that paid off) `[fact]`
- **Problem (avoided).** Frameworks (ORM, mediator, transport) tend to leak into business logic, making it untestable and hard to change.
- **Root Cause.** Convenience coupling.
- **Solution.** V1 used Clean Architecture + a single `Room` aggregate with **clock-as-parameter** (the domain never reads the clock), and enforced inward-only dependencies with **architecture tests**.
- **Prevention Strategy.** Preserve a pure domain with injected ports and a deterministic clock; **enforce boundaries in CI**. *V2 status:* `packages/core` imports only `contracts`; lint-level dependency rules replace NetArchTest (ARCHITECTURE §6, AD-7).

---

# 2. Realtime Synchronization Mistakes

### L-2.1 — Assuming multiple feature-specific hubs would work `[fact]`
- **Problem.** A natural design ("a PlaybackHub, a ChatHub, …") doesn't compose: realtime **groups are per-hub-type**, and a single broadcaster targets one hub.
- **Root Cause.** Group/connection scoping is per hub; splitting hubs fragments the group membership and the broadcast target.
- **Solution.** Consolidate onto **one hub** with a `room:{roomId}` group convention (ADR-0011).
- **Prevention Strategy.** Use **one realtime namespace, room-scoped**; isolate by room membership, not by hub type. *V2 status:* a single Socket.IO namespace, `room:{roomId}` rooms (REALTIME §2, RT-1).

### L-2.2 — Removing all handlers for an event on a shared connection `[fact]`
- **Problem.** Calling the global "remove all listeners for event X" on the single shared connection stripped **other features'** handlers for X.
- **Root Cause.** One connection is shared across features; a global off is a blunt instrument.
- **Solution.** Each feature service returns a **per-handler disposer** that removes only its own handler.
- **Prevention Strategy.** Always unsubscribe the **specific** handler reference; never a blanket per-event removal on a shared socket (REALTIME §6, ARCHITECTURE §8.1).

### L-2.3 — Fetching the snapshot before subscribing (race) `[fact]`
- **Problem.** Events fired in the window between "fetch snapshot" and "subscribe" were lost, leaving stale UI.
- **Root Cause.** Ordering: subscribing after the fetch leaves a gap.
- **Solution.** **Subscribe first, then fetch the snapshot**, and **re-fetch on reconnect**.
- **Prevention Strategy.** Standardize the data-owning hook lifecycle: subscribe → snapshot → reconcile; re-run on `reconnect` (REALTIME §7, §10).

### L-2.4 — Non-idempotent event handling `[fact]`
- **Problem.** Duplicate or out-of-order messages (retries, dual delivery paths, the timer + host both signaling track-end) risked double-applies (e.g., double-skip).
- **Root Cause.** At-least-once delivery and convergent dual paths are inherent to realtime + messaging.
- **Solution.** Idempotent everywhere: consumers **dedupe by `MessageId`**; auto-advance only acts **if the ended item is still current**; live broadcasts are reconciled against authoritative state.
- **Prevention Strategy.** Treat idempotency as a default requirement: revision-gate playback, merge-by-id queue, dedupe-by-id chat, key presence by session (REALTIME §5; PLAYBACK_ENGINE §13).

### L-2.5 — Sending the same payload for live and snapshot `[fact]`
- **Problem.** A live broadcast doesn't need (and shouldn't pay for) the fully-resolved track; a late-join snapshot does.
- **Root Cause.** One-size payloads either bloat the hot path or starve the cold path.
- **Solution.** Live `PlaybackStateChanged` carried `currentTrack = null` (clients resolve from their synced queue); the REST snapshot carried the fully-resolved track.
- **Prevention Strategy.** Keep **live payloads lean, snapshots complete** (REALTIME RT-7, §4.3).

---

# 3. YouTube Integration Challenges

### L-3.1 — The "confirm you're not a bot" / sign-in wall `[fact + operational lesson]`
- **Problem.** The embedded player intermittently shows a YouTube sign-in / "confirm you're not a bot" wall and won't play.
- **Root Cause.** **Server-side** YouTube anti-abuse keyed on **IP reputation**, a **signed-out browser**, or a **specific video**. It is **not caused by our code** (we run no bot detection) and is **not bypassable from the browser**.
- **Solution.** Reduce the triggers and always offer an escape: use the **real `youtube.com` host** (not nocookie), declare `origin`/`widget_referrer`, require a **user gesture** before play, and ship an always-visible **"Open on YouTube ↗ · Retry"** hatch.
- **Prevention Strategy.** Accept this as a provider constraint, not a bug to "fix." Degrade gracefully (keep chat/queue/presence alive), never block the room, and document for users that signing into YouTube in that browser helps. *Lesson:* repeated dev testing from one IP can get it **hard-flagged** — switch networks or wait it out (PLAYBACK_ENGINE §17).

### L-3.2 — Using `youtube-nocookie.com` to seem "privacy-friendly" `[fact]`
- **Problem.** The cookieless embed host made playback **worse**, increasing bot-wall hits.
- **Root Cause.** A cookieless session looks **bot-like** to YouTube's anti-abuse, and it blocks the real remedy (a signed-in youtube.com session in the user's browser).
- **Solution.** Use **`https://www.youtube.com`** as the player host (configurable, but do **not** use nocookie).
- **Prevention Strategy.** Default to the real host; treat nocookie as a known anti-pattern for this use case.

### L-3.3 — No track duration without the Data API `[fact]`
- **Problem.** Without a YouTube Data API key, metadata fallbacks (oEmbed/noembed) return title + thumbnail but **no duration**, so auto-advance timing and the now-playing length were wrong.
- **Root Cause.** Only the Data API exposes duration; the free fallbacks don't.
- **Solution.** Enter the track with a **placeholder duration**; the host's player measures the real duration and **reports it**, correcting timing and display. The real fix is to set the Data API key.
- **Prevention Strategy.** Establish a **duration truth ordering**: provider API → host-measured → only then trust the auto-advance timer; while duration is unknown, let the player's explicit **ENDED** signal be the primary end trigger. *V2 status:* duration corrections also **broadcast** so all clients' rows update, not just the host's (DATABASE §1; PLAYBACK_ENGINE §13.1; REALTIME §6.4).

### L-3.4 — Autoplay-on-load without a gesture `[fact]`
- **Problem.** Auto-playing on mount failed (browser autoplay policy) and looked bot-like.
- **Root Cause.** Browsers permit **only muted autoplay**; unmuted autoplay requires a user gesture.
- **Solution.** Start the player **muted**, unmute on the first user interaction, and show a "Tap to unmute" affordance; keep a click-to-play facade as an anti-bot lever.
- **Prevention Strategy.** Always begin muted + gesture-to-unmute for embedded players (PLAYBACK_ENGINE §17; SPEC §7.8).

### L-3.5 — (Design win) Never proxy provider audio `[fact]`
- **Problem (avoided).** Re-streaming provider audio would create licensing, bandwidth, and ToS problems.
- **Root Cause.** Temptation to control the media pipeline end-to-end.
- **Solution.** Embed the provider's **own** player; synchronize only **control + position**.
- **Prevention Strategy.** Keep this boundary firmly in V2; the engine syncs a timeline, never bytes (PLAYBACK_ENGINE §1, §17).

---

# 4. Playback Drift Issues

### L-4.1 — Listeners' positions diverge over a long track `[fact]`
- **Problem.** Over a long song, participants drifted out of sync.
- **Root Cause.** Clients **can't trust their local clock** relative to the server, and player position readings are **noisy during buffering**.
- **Solution.** **Server-authoritative anchor** `{position, status, updatedAt}` + **clock-offset estimation** (NTP-style probe) + a **reconcile loop** that computes the expected position and aligns the player.
- **Prevention Strategy.** Keep the server as the single clock authority; filter the clock offset and ignore readings while buffering. *V2 status:* preserved and tightened with EWMA-filtered offset, clock-jump detection, and predictive (latency-compensated) seeks (PLAYBACK_ENGINE §5–§6).

### L-4.2 — Seek-on-every-drift caused audible "thrash" `[fact]`
- **Problem.** Correcting every small drift by seeking produced audible rebuffering "thrash."
- **Root Cause.** Hard seeking is the only correction lever V1 had; applying it to small drifts is jarring and triggers rebuffers.
- **Solution.** **Rate-limit** reconciliation: only seek past a **drift threshold (≈750 ms)**, with a **cooldown**, **not during buffering**, plus a brief **grace after host actions** so guests don't fight an in-flight command.
- **Prevention Strategy.** Add a **smooth correction tier** so you don't have to choose between thrash and drift. *V2 status:* two-tier correction — continuous micro-rate nudging (where the provider supports it) for small drift, hard seek only for discontinuities — plus an in-sync dead-band, cooldown, and host grace (PLAYBACK_ENGINE §8, §18).

### L-4.3 — Abandoning host→guest position forcing entirely `[fact / gap]`
- **Problem.** To escape the thrash (L-4.2), V1 stopped forcing guests to the host's exact position — "the host drives, guests reconcile." The trade-off: guests could **drift within tolerance** and the sync wasn't tight.
- **Root Cause.** Without a smooth corrector, *any* forcing meant thrash, so forcing was removed wholesale.
- **Solution.** Accept loose-but-stable sync for the MVP; note that **re-adding strict forcing within an anti-thrash envelope is future work** (§13.1).
- **Prevention Strategy.** Reintroduce bounded forcing **through the smooth tier**, so drift never accumulates *and* nothing thrashes. *V2 status:* exactly this — continuous convergence keeps drift trimmed to near-zero (PLAYBACK_ENGINE §8.1, §18 row 1).

---

# 5. Host-Authority Problems

### L-5.1 — Failing over the host on a transient disconnect `[fact]`
- **Problem.** A naive design would move host ownership the instant the host's socket dropped — so a **refresh or network blip** would steal the host's control and churn the room.
- **Root Cause.** Treating a transport disconnect as a **departure** (M5: transient ≠ terminal).
- **Solution.** On disconnect, open a **reconnect grace window (~30 s)**; do **not** fail over or fire presence/host events yet. Only on **grace expiry** does the reaper finalize offline and transfer host.
- **Prevention Strategy.** Always distinguish *disconnected (in grace)* from *left*. Rebind identity on return; fail over only after the window. *V2 status:* preserved, with an added offline-debounce so the UI doesn't even flicker on a quick refresh (REALTIME §8–§11; SPEC §7.10, §7.12).

### L-5.2 — Choosing the next host ambiguously `[fact]`
- **Problem.** When the host genuinely leaves/expires, *who* becomes host must be deterministic and sensible.
- **Root Cause.** No rule = arbitrary or empty host.
- **Solution.** Transfer to the **longest-present remaining online participant** (by join time); if none online, the longest-present offline; if nobody remains, the room goes **Idle** and playback pauses.
- **Prevention Strategy.** Keep the deterministic "longest-present" rule and the invariant **exactly one host while participants exist** (SPEC §7.10).

### L-5.3 — Treating authority as an auth concern `[fact]`
- **Problem.** It's tempting to bolt host-control onto an authorization framework.
- **Root Cause.** Conflating *identity/authz* with *domain authority*.
- **Solution.** V1 has **no auth**; "host" is a **domain rule** (`Room` checks `HostSessionId`), enforced on every host-only action.
- **Prevention Strategy.** Keep host-authority a **domain invariant** checked per command, independent of any future auth layer; never trust a client's claim of being host (SPEC §7.2; ARCHITECTURE §13).

---

# 6. SignalR Lessons

> SignalR-specific lessons; several generalize to any WebSocket framework and are reflected in V2's Socket.IO design (REALTIME_ENGINE.md).

### L-6.1 — Bind identity from the connection, never from a method argument `[fact]`
- **Problem.** Trusting a `sessionId` passed in a hub method call would let any client impersonate another.
- **Root Cause.** Method arguments are client-controlled.
- **Solution.** Bind the session from the **httpOnly cookie at connection time**; derive the actor from the connection, never the payload.
- **Prevention Strategy.** Handshake-time identity binding is mandatory; authority checks use the bound identity (REALTIME §3, RT-2).

### L-6.2 — `OnDisconnected` must not mutate presence/host `[fact]`
- **Problem.** Doing presence/host changes in the disconnect handler churns state on every blip.
- **Root Cause.** Disconnect ≠ leave (M5).
- **Solution.** `OnDisconnectedAsync` **only opens the grace window**; a separate reaper finalizes after expiry.
- **Prevention Strategy.** Keep disconnect handlers minimal (open grace, decrement presence ref-count); finalize elsewhere (REALTIME §8, §11).

### L-6.3 — No realtime backplane = no horizontal scale `[gap]`
- **Problem.** With more than one server instance, broadcasts wouldn't fan out across instances — the realtime layer couldn't scale out.
- **Root Cause.** The Redis backplane for the realtime layer was **designed but deferred**.
- **Solution.** V1 ran effectively single-instance for realtime; the backplane remained a documented future step.
- **Prevention Strategy.** Wire the **multi-instance adapter from day one**; require sticky sessions at the proxy. *V2 status:* Socket.IO Redis adapter + Redis emitter are baseline, not deferred (ARCHITECTURE §12, AD-3; REALTIME §2, §12).

### L-6.4 — Map server exceptions to client-safe errors `[fact]`
- **Problem.** Raw server exceptions leaking to clients are a security/UX hazard.
- **Root Cause.** Unfiltered exception propagation over the hub.
- **Solution.** A `HubExceptionFilter` mapped domain/rate-limit exceptions to client-safe `HubException`s and hid unexpected ones.
- **Prevention Strategy.** Centralize a typed error catalog mapped to safe client errors (and HTTP statuses); never leak internals (REALTIME §4.2, Appendix B).

### L-6.5 — Configure client auto-reconnect explicitly `[fact]`
- **Problem.** Default reconnect behavior may be too aggressive or too passive.
- **Root Cause.** Untuned reconnection.
- **Solution.** `withAutomaticReconnect([0, 1000, 2000, 5000, 10000])` + UI banner on reconnecting + re-join/re-pull/re-probe on reconnected.
- **Prevention Strategy.** Use capped exponential backoff with jitter and a defined on-reconnect resync routine (REALTIME §8, §13).

---

# 7. Deployment Lessons

### L-7.1 — Build-time public config baked the wrong URLs `[operational lesson, rooted in code]`
- **Problem.** The deployed/shared frontend kept calling `http://localhost:8080` and failed for anyone not on the build machine.
- **Root Cause.** `NEXT_PUBLIC_*` values (`API_BASE_URL`, `HUB_BASE_URL`, …) are **baked into the browser bundle at build time** (as Docker build args) and **default to localhost**. There is **no runtime override**.
- **Solution.** Pass the correct URLs as build args and **rebuild** (`docker compose build frontend`).
- **Prevention Strategy.** Don't bake environment-specific config (M2). Prefer **same-origin relative URLs** and **runtime** config. *V2 status:* single origin + relative URLs + `/api/config` for runtime values — the whole class is gone (ARCHITECTURE §13, AD-2).

### L-7.2 — Cross-site cookies need `SameSite=None; Secure` `[operational lesson]`
- **Problem.** When the SPA origin and API origin differ, the session cookie isn't sent, so realtime/join fail.
- **Root Cause.** The cookie was `SameSite=Lax` (+ `Secure=Request.IsHttps`), which is **not sent cross-site**.
- **Solution.** Over HTTPS cross-site, set the cookie `SameSite=None; Secure`; ensure TLS termination at the proxy.
- **Prevention Strategy.** Either make the deployment **same-origin** (no cross-site cookie needed) or explicitly set `SameSite=None; Secure`. *V2 status:* single origin makes the cookie first-party by default (ARCHITECTURE §13; §8 below).

### L-7.3 — Rate limiting behind a proxy collapses all clients to one IP `[fact]`
- **Problem.** Behind a reverse proxy, the rate-limiter's client id became the **proxy IP**, lumping all users together.
- **Root Cause.** Without forwarded-header handling, the app sees the proxy's address, not the client's.
- **Solution.** Configure `ForwardedHeaders` so the real client IP is used for the rate-limit `ClientId`.
- **Prevention Strategy.** Always configure forwarded-headers/trusted-proxy when deploying behind ingress; key rate limits on a stable per-client identity (e.g., session) rather than raw IP where possible.

### L-7.4 — Migration strategy differs by topology `[fact]`
- **Problem.** Running schema migrations on every instance's startup is unsafe for multi-instance deploys.
- **Root Cause.** Concurrent auto-migration races; also the DDL-permissions trap (§9.1).
- **Solution.** `Database:AutoMigrate` for single-instance; a **pre-deploy migration step** for multi-instance.
- **Prevention Strategy.** Run migrations as a **dedicated deploy step** with a privileged role; never auto-migrate from N app instances (DATABASE §11; ARCHITECTURE AD-10).

---

# 8. Cloudflare Tunnel Lessons

### L-8.1 — Sharing a dev stack over a tunnel breaks realtime/join `[operational lesson — not in repo]`
- **Problem.** Exposing the local stack via a Cloudflare tunnel "works for the page but realtime/join fails" — CORS errors, the cookie isn't sent, the WebSocket won't connect.
- **Root Cause.** **Three** origin-bound assumptions break at once (M1):
  1. The FE bundle still points at `localhost:8080` (build-time bake — L-7.1); a public browser can't reach localhost.
  2. The tunnel origin isn't in the API's CORS allow-list, so the credentialed cross-origin request is rejected.
  3. The session cookie is `SameSite=Lax` and isn't sent cross-site between the FE and API origins.
- **Solution.** Rebuild the FE with `NEXT_PUBLIC_*` = the tunnel URL; add the tunnel origin to `Cors:AllowedOrigins`; serve over HTTPS with the cookie `SameSite=None; Secure`.
- **Prevention Strategy.** **A tunnel changes the origin — update every origin-bound setting together** (baked URLs, CORS, cookie SameSite). Better: eliminate the coupling. *V2 status:* same-origin design + runtime config means a tunnel/domain change needs no rebuild, no CORS edit, and no cookie change (ARCHITECTURE §13, AD-2). For a permanent setup, use a **stable domain + managed TLS** rather than ad-hoc tunnels (§13.2).

---

# 9. Docker Lessons

### L-9.1 — Runtime DB user lacked DDL ownership → migration crash-loop `[fact]`
- **Problem.** `Database:AutoMigrate`, running as the app DB user, crash-looped with `42501: must be owner of table`.
- **Root Cause.** The runtime role (`mmmuzik_app`) has **DML grants but not table ownership**. If the tables were originally created by the `postgres` superuser out-of-band, the app user **cannot run DDL**.
- **Solution.** **Apply migrations as the superuser/owner** (e.g., `Username=postgres dotnet ef database update …`) so app startup no-ops; long-term, grant DDL/ownership to the app role or use a privileged pre-deploy step.
- **Prevention Strategy.** **Two roles**: a privileged **migration role** (DDL/owner) and a **runtime role** (DML only); migrate in a deploy step, never from the runtime user. *V2 status:* codified as a first-class rule (DATABASE §11; ARCHITECTURE AD-10).

### L-9.2 — RabbitMQ `ACCESS_REFUSED` noise in dev `[fact]`
- **Problem.** In some dev setups, outbox publishing failed broker auth, generating background error noise.
- **Root Cause.** Broker credential/vhost mismatch in the dev environment.
- **Solution.** It did **not** fail requests (in-process broadcast is primary), so it was tolerated as noise to fix separately.
- **Prevention Strategy.** Either provision broker creds/vhost reliably or, for an MVP, **don't run a broker at all**. *V2 status:* broker removed (ARCHITECTURE AD-4) — the noise source is gone.

### L-9.3 — Integration tests need a running Docker daemon `[fact]`
- **Problem.** Testcontainers-backed (Postgres) integration tests fail intermittently when Docker isn't running locally.
- **Root Cause.** Those tests require a live Docker daemon.
- **Solution.** Offline-verify by filtering them out (`dotnet test --filter "FullyQualifiedName!~PersistenceTests&!~OutboxProcessorTests"`); run the full suite where Docker is available (CI).
- **Prevention Strategy.** Separate **unit/architecture** tests (no Docker) from **integration** tests (Docker); make the split explicit in CI and local docs so contributors aren't blocked.

### L-9.4 — (Good practices to keep) `[fact]`
- **Problem (avoided).** Bloated, root-running, unhealthy containers.
- **Solution.** Multi-stage Dockerfiles, **non-root** runtime users, **healthchecks**, and `depends_on: healthy` start ordering (infra healthy → API migrates → FE).
- **Prevention Strategy.** Keep these as the V2 container baseline.

---

# 10. Browser Caching Lessons

### L-10.1 — Stale bundle served after an env rebuild `[operational lesson]`
- **Problem.** After rebuilding the FE with new env (e.g., a new API URL), users still hit the **old** API / saw stale UI.
- **Root Cause.** The standalone bundle + static assets are cached by the browser/CDN; the old **hashed bundle (with the old baked URL)** keeps being served until the cache clears. (Compounded by L-7.1: the URL was baked, so the only way to change it was a rebuild — which then had to defeat the cache.)
- **Solution.** Hard-refresh / clear cache; ensure new builds produce **new asset hashes**; set sensible cache headers (short for HTML, long+immutable for hashed static assets).
- **Prevention Strategy.** Don't bake environment values (so most changes don't require a bundle change at all — M2); configure cache headers so HTML revalidates while hashed assets cache aggressively; verify deploys with a cache-busting check. *V2 status:* runtime config + same origin removes the most common trigger (ARCHITECTURE §13).

---

# 11. Production-Readiness Lessons

> These are `[gap]`s: capabilities V1 *designed for* but **deferred**. The lesson is to not let them slip again, because each is felt exactly at launch/scale.

### L-11.1 — Observability defined but not exported `[gap]`
- **Problem.** OpenTelemetry traces/metrics were defined, but **not exported** to a backend with dashboards/alerts — so diagnosing sync/realtime issues in production was blind.
- **Root Cause.** Instrumentation shipped; the export + dashboards were future work.
- **Solution / path.** Export traces/metrics (active rooms, online participants, realtime delivery latency, **client-reported drift**, outbox depth, DLQ count) with dashboards and alerts.
- **Prevention Strategy.** Treat **observability export** as part of "done," not a follow-up. Feed client-reported drift back into adaptive sync tuning (PLAYBACK_ENGINE §14; ARCHITECTURE §13).

### L-11.2 — Thin API/transport test coverage `[gap]`
- **Problem.** No `WebApplicationFactory`-style API tests for status mapping, cookie issuance, and the 404/403/409/429 paths; broker/Redis round-trips under-tested.
- **Root Cause.** Domain/unit tests were strong; the transport edges lagged.
- **Solution / path.** Add API-level tests (ProblemDetails mapping, cookie issuance, error-status paths) and broker/cache integration tests.
- **Prevention Strategy.** Cover the **contract edges** (HTTP status, error codes, cookies, realtime acks) as first-class tests, not just the domain core.

### L-11.3 — Operational tooling for the durable path missing `[gap]`
- **Problem.** The projections consumer was **log-only**; there was no DLQ drain/replay tool and no outbox-depth alerting.
- **Root Cause.** The durable/messaging path was secondary and under-tooled.
- **Solution / path.** Build a DLQ drain/replay tool and outbox-depth alerting *if* the broker is kept.
- **Prevention Strategy.** Any async/queue you run needs **operability** (visibility, replay, alerting) before production. *V2 status:* removing the broker removes this burden for the MVP (ARCHITECTURE AD-4).

### L-11.4 — No published contract / API document `[gap]`
- **Problem.** No published OpenAPI doc and no single shared realtime contract module; FE types were hand-kept (feeding L-1.1).
- **Root Cause.** Contract artifacts weren't generated/published.
- **Solution / path.** Publish OpenAPI (Swashbuckle was referenced) with response types; generate FE types; maintain one shared realtime contract.
- **Prevention Strategy.** Generate types from one source. *V2 status:* `packages/contracts` is the single shared contract for REST + realtime (ARCHITECTURE AD-1).

### L-11.5 — Capacity claim unverified `[gap]`
- **Problem.** The 50-participant-per-room target (NFR-3) was a design goal, **not load-tested** on the real WebSocket path.
- **Root Cause.** Load testing deferred.
- **Solution / path.** Load-test a 50-participant room and measure end-to-end drift on the real WS path.
- **Prevention Strategy.** Validate NFRs with a test, not a number in a doc; do it before claiming readiness (ARCHITECTURE §12).

### L-11.6 — Auth deferred (acceptable, but be explicit) `[gap / by design]`
- **Problem.** Anyone with the code/link can participate; no accounts.
- **Root Cause.** Deliberate MVP choice for zero-friction joining (§2.0).
- **Solution / path.** Optional accounts layered on top of the session model later, keeping the guest fast path (§13.3).
- **Prevention Strategy.** Keep host-authority a domain rule so adding auth later is additive; design the data model to accept accounts without a rewrite. *V2 status:* optional `users`/first-class `sessions` tables make this additive (DATABASE §1).

---

# 12. Top Rules for V2 (cheat sheet)

Distilled, in priority order:

1. **One repo, one language, one shared contract** — drift dies at compile time. (L-1.1)
2. **Single origin + runtime config** — never bake environment URLs; relative URLs everywhere. (L-7.1, L-8.1, L-10.1)
3. **Server is the clock authority; clients reconcile** — never trust the client clock. (L-4.1)
4. **Two correction tiers** — smooth for small drift, hard seek only for discontinuities. (L-4.2, L-4.3)
5. **Disconnect ≠ leave** — grace window first; finalize/fail-over only on expiry. (L-5.1, L-6.2)
6. **Idempotency by default** — revision-gate, dedupe-by-id, "advance only if current." (L-2.4)
7. **Bind identity at the handshake, never from a payload** — authority is a domain rule. (L-5.3, L-6.1)
8. **Wire the multi-instance realtime adapter from day one** — with sticky sessions. (L-6.3)
9. **Two DB roles** — privileged migrations as a deploy step; runtime is DML-only. (L-7.4, L-9.1)
10. **Embed the provider player, never proxy audio** — start muted, gesture-to-unmute, always offer "Open on YouTube." (L-3.1, L-3.4, L-3.5)
11. **Pin stable, permissively-licensed dependencies** — avoid bleeding-edge and newly-commercial majors. (L-1.3, L-1.4)
12. **Ship observability, contract docs, API tests, and load tests as part of "done"** — not as follow-ups. (L-11.1–L-11.5)

---

*This retrospective is the institutional memory of MMMuzik V1. Every V2 design doc (`SPEC`, `ARCHITECTURE`, `PLAYBACK_ENGINE`, `REALTIME_ENGINE`, `DATABASE`) traces decisions back to these lessons. When V2 makes its own mistakes, append them here with the same Problem → Root Cause → Solution → Prevention structure — the point of this file is that the same mistake is never paid for twice.*
