# QUEUE_AND_PLAYER_FIXES.md

> Three targeted fixes. The playback-sync engine, clock sync, Socket.IO architecture, and queue-sync architecture were **not modified** — only the specific defects below were addressed, preserving all realtime behavior.

---

## Verification (all green)

| Check | Command | Result |
|-------|---------|--------|
| Types | `tsc --noEmit` | ✅ exit 0 |
| Lint | `next lint --dir src` | ✅ No warnings or errors |
| Unit | `vitest run tests/unit` | ✅ **58 passed** (10 files; incl. 5 new selector tests) |
| UI | `vitest run tests/ui` | ✅ **13 passed** (5 files) |
| Integration | `vitest run tests/integration` (live Postgres+Redis via `docker compose up -d postgres redis`) | ✅ **47 passed** (5 files; incl. updated + new skip tests) |
| Build | `next build` | ✅ all 15 routes compiled |

---

## ISSUE 1 — YouTube video showed black bars (didn't fill the player)

### Root cause
The player box used `aspect-video w-full max-h-[60vh]`. `aspect-video` derives height from width, but on wide viewports `width × 9/16` exceeds `60vh`, so `max-h` clamped the **height** while the width stayed 100%. That makes the **box wider than 16:9**. The YT iframe fills the box (100%×100%), so YouTube renders the 16:9 video centered inside the too-wide iframe → **pillarbox black bars on the left/right**. It was a layout/CSS conflict, not the video source.

### Fix (root cause, no hack)
Bound the height by capping the **width** instead, so the box always keeps a true 16:9 ratio:
`relative mx-auto aspect-video w-full max-w-[133.33vh] overflow-hidden bg-black` (`133.33vh ≈ 75vh × 16/9`). The iframe now always matches 16:9 → the video fills it with no internal bars. On normal desktop/tablet/mobile the cap doesn't engage and the video fills the full container width; only on very wide/short viewports does the 16:9 video center (no distortion, no overflow).

### Before / After
- **Before:** wide screens → box squashed wider-than-16:9 → black bars beside the video.
- **After:** box is always 16:9 → video fills it (like a native responsive YouTube embed); fills full width on common screens; responsive.

**File:** `src/features/youtube/components/YouTubePlayer.tsx` (container className only).

---

## ISSUE 2 — "Up Next" count was wrong

### Root cause
The panel counted `items.filter(i => i.id !== currentTrackId).length` — "every item that isn't the current one." But completed tracks **linger** in the queue (auto-advance moves the pointer without deleting the played item), so they sit *before* the current track and were being counted. The correct definition is **videos after the currently-playing one, by position**.

### Fix (single source of truth)
New pure selector `upNextCount(items, currentTrackId)` in `src/features/queue/selectors.ts` counts items whose `position` is greater than the current item's position (and returns 0 when nothing is playing or the current isn't in the queue). A `useUpNextCount()` hook wires it to the queue + playback stores; `QueueList` consumes it. This is the only place the count is computed.

```
[A▶]            → 0
[A▶, B]         → 1
[A▶, B, C]      → 2
[A▶, B, C, D]   → 3
[done, B▶, C]   → 1   (completed track before current is NOT counted)
```

### Before / After
- **Before:** `[A▶, B, C]` showed **3 Up Next**; lingering completed tracks inflated the count.
- **After:** `[A▶, B, C]` shows **2 Up Next**; current, completed, and removed tracks are excluded.

**Files:** `src/features/queue/selectors.ts` (new), `src/components/QueueList.tsx`.

---

## ISSUE 3 — Skip left the skipped video in the queue

### Root cause
`skip()` called `advanceIfCurrent()`, which moves the playback anchor to the next item but **does not delete** the skipped item — so the skipped track stayed in the queue (and would re-appear from the server snapshot on reconnect).

### Fix (server-side, server-authoritative)
`skip()` now: validates host → **advances** the anchor to the next track (or idle) via the existing `advanceIfCurrent` → **removes** the skipped item from the queue (`queueRepo.removeItem`, which deletes + recompacts positions in a transaction) → **broadcasts** the full queue snapshot (`broadcastQueue`, which also updates the Redis cache). No client-side filtering; the deletion is persisted in Postgres and the cache is refreshed, so the track cannot reappear after reconnect.

```
Before:  [A▶][B][C]   — host Skip →   After:  [B▶][C]      (A removed, positions recompacted)
last track: [A▶]      — host Skip →   idle, empty queue
```

**File:** `src/server/services/queueService.ts` (`skip`).

---

## Files modified

| File | Change | Issue |
|------|--------|-------|
| `src/features/youtube/components/YouTubePlayer.tsx` | Player box: cap height via `max-w` to keep a true 16:9 ratio | 1 |
| `src/features/queue/selectors.ts` *(new)* | `upNextCount()` + `useUpNextCount()` — single source of truth | 2 |
| `src/components/QueueList.tsx` | Use `useUpNextCount()` for the panel meta | 2 |
| `src/server/services/queueService.ts` | `skip()` removes the skipped track after advancing | 3 |
| `tests/unit/queue.selectors.test.ts` *(new)* | Unit tests for `upNextCount` (all examples + edge cases) | 2 |
| `tests/integration/queue.service.test.ts` | Skip tests assert the skipped track is removed + positions recompacted | 3 |

---

## Sync impact
**None to the sync engine.** The playback anchor math, `computeExpectedPosition`, drift reconcile, and clock sync are untouched. Issue 1 is pure CSS. Issue 2 is a display-only derived count (no state writes). Issue 3 reuses the existing `advanceIfCurrent` (same anchor transition used by auto-next and the server timer) — the skipped item's removal does not touch the anchor (the anchor stores the current item **id**, unaffected by position recompaction).

## Realtime impact
- Issue 3 emits the **existing** broadcasts only: `advanceIfCurrent` → `playback:stateChanged` (+ `playback:nextTrack`), then `skip` → `queue:updated` (full snapshot). Clients reconcile exactly as before; the queue updates immediately for everyone and is consistent on reconnect (Postgres deletion + Redis cache refresh). No new events, routes, or schema. Host-only authority on `playback:skip` is unchanged (`requireHost`).
- Issues 1 & 2 are client-only and emit/consume no realtime events.

## Tests performed
- **Unit (new):** `upNextCount` — `[A▶]=0`, `[A▶,B]=1`, `[A▶,B,C]=2`, `[A▶,B,C,D]=3`, completed-before-current excluded, order-independent (by position), 0 when idle / current-missing.
- **Integration (updated, run against live DB+Redis):** skip removes the current track and advances (`[A▶,B]→[B▶]`, `[A▶,B,C]→[B▶,C]` with positions `[0,1]`), and draining the last track empties the queue + goes idle.
- **Existing suites:** all unchanged tests still pass (UI 13, unit 53 prior + 5 new, integration 47).
- **Manual (recommended):** confirm the video fills the frame with no side bars across desktop/tablet/mobile widths; "Up Next" decrements correctly as tracks play/skip; Skip removes the current row immediately and it stays gone after a refresh.

> Integration tests require Postgres+Redis: `docker compose up -d postgres redis` then `DATABASE_URL=postgresql://mmmuzik:mmmuzik@localhost:5432/mmmuzik REDIS_URL=redis://localhost:6379 vitest run tests/integration`.

---

## FOLLOW-UP (round 4) — Queue crushed to a sliver on desktop after adding songs

### Symptom
On the desktop 3-column layout, once a song was playing the **Queue panel was squeezed to ~60px** (just its header) — so after a participant added songs, the queue rows had no room to render. Reported as a "UI error in the Queue section after adding a song." Mobile/tablet were unaffected.

### Root cause
A regression introduced by ISSUE 1's height-cap technique. In `DesktopLayout` the middle column stacks the player **above** the queue in the **same** column:

```
middle column = PlaybackPanel (player + metadata)  ▸ then ▸  QueueList (flex-1)
```

The player box was capped at `max-w-[133.33vh]` ≈ **75vh tall**. On a wide viewport the ~1220px-wide column makes the 16:9 video ~690px (~73vh); with the title + "Open on YouTube / Retry" hatch below it, the whole `PlaybackPanel` consumed ~85vh — leaving the `flex-1` queue only ~60px. The queue still scrolled internally (no overflow/crash), but was effectively unusable. The 75vh cap is fine on mobile (own tab) and tablet (own scroll column) where the player doesn't share space with the queue; it only over-reached on desktop.

### Fix (root cause, no hack)
Tighten the player's height cap **only on desktop** (`lg`, ≥1024px — the exact width where `useBreakpoint` switches to the 3-col layout), keeping the generous cap everywhere else:

`...aspect-video w-full max-w-[133.33vh] overflow-hidden bg-black lg:max-w-[100vh]`

`lg:max-w-[100vh]` ≈ **56.25vh tall** (100vh × 9/16), so on desktop the player tops out at ~56vh and the queue keeps a usable, scrollable ~25–30vh. Same width-cap technique as ISSUE 1 → the video stays true 16:9 (no pillarbox; it centers with the aurora at the sides only on wide/short viewports). The cap engages only when the column is wide enough to need it; narrower desktops fill the full width as before.

| File | Change | Issue |
|------|--------|-------|
| `src/features/youtube/components/YouTubePlayer.tsx` | Add `lg:max-w-[100vh]` to the player box (desktop-only tighter height cap) + comment | desktop queue crush |

### Impact
**Client-only, CSS-only.** No change to the sync engine, realtime events, queue/playback services, stores, or any non-`lg` breakpoint. Server-authoritative queue/playback behavior and host-only restrictions are untouched.

### Verification (all green)
| Check | Command | Result |
|-------|---------|--------|
| Types | `tsc --noEmit` | ✅ exit 0 |
| Lint | `eslint "src/**/*.{ts,tsx}"` | ✅ exit 0 |
| Unit + UI | `vitest run tests/unit tests/ui` | ✅ **71 passed** (15 files) |
| Build | `next build` | ✅ all 15 routes compiled (Tailwind emitted `lg:max-w-[100vh]`) |

> Could not visually reproduce in a live browser this session (no Postgres/Redis containers or browser-automation tooling available); diagnosis is from the screenshot + layout math above. **Manual check recommended:** on a wide desktop window with a song playing, confirm the player is bounded (~56vh) and the queue shows several rows with its own scrollbar; verify mobile/tablet players are unchanged.
