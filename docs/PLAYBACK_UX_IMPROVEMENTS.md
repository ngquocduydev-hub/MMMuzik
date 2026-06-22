# PLAYBACK_UX_IMPROVEMENTS.md

> Five playback/UX improvements implemented on top of the existing server-authoritative engine. **No engine behavior was changed** — the playback/queue/clock/realtime architecture is intact. Most server-side enforcement these features require already existed; the work was concentrated in the presentation/player layer plus verifying and surfacing the existing server guarantees.

---

## Summary

| # | Feature | Where | Server change? |
|---|---------|-------|----------------|
| 1 | Auto-unmute on room join | `YouTubePlayer` | No |
| 2 | Only host can control playback | UI (rebuilt) + **existing** server guards | No (already enforced) |
| 3 | Video keeps playing across mobile tabs | `RoomLayout` (mobile tabs) | No |
| 4 | Skip current video (host) | `QueueList` button → **existing** `playback:skip` | No (already exists) |
| 5 | Fix "Up Next" count | `QueueList` (display selector) | No |

**Files modified**
- `src/features/youtube/components/YouTubePlayer.tsx` — Feature 1
- `src/components/RoomLayout.tsx` — Feature 3
- `src/components/QueueList.tsx` — Features 4 + 5
- `tests/ui/QueueList.test.tsx` — updated assertions for Features 2/4/5

**Files audited & confirmed correct (unchanged)**
- `src/server/services/playbackService.ts`, `src/server/services/queueService.ts`, `src/server/socket/handlers/playbackHandlers.ts`, `src/server/socket/handlers/queueHandlers.ts`, `src/shared/domain/playback.ts`, `src/shared/domain/room.ts`, `src/app/api/rooms/[id]/playback/route.ts`.

---

## 1. Root cause of each issue

**Feature 1 — manual unmute required.** Browsers block *audible* autoplay without a user gesture, so the player starts muted (`mute:1`) to guarantee autoplay. There was a "Tap to unmute" affordance + a first-gesture listener, but the player never *proactively* enabled sound even on browsers/contexts where audible autoplay is actually allowed, and the prompt copy was weak.
→ **Fix:** on `onReady`, query `navigator.getAutoplayPolicy('mediaelement')`; if it returns `allowed`, unmute immediately (no gesture needed). Otherwise stay muted and rely on (a) the global first-gesture unmute (any pointer/key anywhere → sound on, one interaction) and (b) a clearer **"Tap to enable sound"** button. No multi-click path.

**Feature 2 — guests could appear to control playback.** Two layers existed but one was implicit. After the prior UI rebuild guests already get a read-only YouTube player (`controls:0, disablekb:1`) and there is no custom transport bar; the server already rejects forged commands. The remaining risk was the *new* Skip control and confirming DevTools can't bypass.
→ **Fix/confirm:** Skip is rendered host-only; **server already enforces** host authority on every mutating command (see §4). No client trust.

**Feature 3 — player stopped when switching mobile tabs.** The mobile layout used Radix `Tabs` whose `TabsContent` **unmounts inactive tabs by default**. Switching away from "Player" destroyed the `YouTubePlayer`, tearing down the iframe (playback stops, state lost).
→ **Fix:** `forceMount` every mobile `TabsContent`; Radix keeps them in the DOM and toggles `hidden`. The YouTube iframe is never unmounted, so audio + timeline + sync continue (a cross-origin iframe under `display:none` keeps its media running).

**Feature 4 — no manual skip.** After the move to native YouTube controls, the only skip path was track-end auto-advance; there was no host control to skip on demand. The server `skip()` already existed but was unused by the UI.
→ **Fix:** a host-only **Skip** button next to **Add song** emitting the existing `playback:skip`.

**Feature 5 — "Up Next" overcounted.** The current track stays *in* the queue (highlighted/pinned), and the panel meta showed `items.length`, so "A playing + B queued" displayed "2 up next".
→ **Fix:** count only items whose id ≠ `currentTrackId` → "1 up next". Display-only; the store still holds the full ordered list.

---

## 2. Files modified (detail)

| File | Change |
|------|--------|
| `YouTubePlayer.tsx` | Added `soundAutoplayAllowed()` (feature-detected `getAutoplayPolicy`, safe `false` default). `onReady` auto-unmutes when allowed. Corner prompt relabeled **"Tap to enable sound"** (+`aria-label`). First-gesture unmute + role-keyed host/guest control modes unchanged. |
| `RoomLayout.tsx` | Mobile `TabsContent` × 4 now `forceMount` + `data-[state=inactive]:hidden`. Player (and chat/queue/people) stay mounted across tab switches. Desktop/tablet already mount the player once. |
| `QueueList.tsx` | Host-only **Skip** button (`SkipForward`, `aria-label="Skip current track"`) in the header action, disabled when no current track, emits `playback:skip`. "Up next" meta = `items.filter(i => i.id !== currentTrackId).length`. |
| `tests/ui/QueueList.test.tsx` | Asserts "1 up next" (was "2"), Skip enabled for host with a current track, Skip absent for guests, current track not removable. |

---

## 3. Architecture impact
- **None to the engine.** Server-authoritative playback anchor, queue engine, clock sync, Redis/Postgres model, and the Socket.IO contract (`src/shared/events`) are unchanged. No new events, routes, schemas, or domain functions.
- Features 4 & 5 reuse existing primitives: `playback:skip` → `queueService.skip()` → `advanceIfCurrent()` (the same advance path used by auto-next and the server timer) → `playTrack`/`goIdle`. Feature 5 is a pure display derivation.
- Feature 1/3 are presentation-only (player init policy, mount lifecycle).

## 4. Security impact (Feature 2 — verified, defense in depth)
- **Identity is bound at the handshake** (`socket.data.sessionId`), never read from a payload — a client cannot claim to be the host.
- **Every mutating command re-checks host authority on the server**, regardless of UI:
  - `playback:play|pause|seek` → `playbackService.applyCommand` → `isHost()` → `PLAYBACK_FORBIDDEN`.
  - `playback:skip` → `queueService.skip` → `requireHost` → `QUEUE_FORBIDDEN`.
  - `playback:trackEnded` → `advanceOnEnded` → non-host events ignored (server timer backstops).
  - `playback:reportDuration`, `queue:remove|reorder|clear` → `requireHost`.
- **No mutating REST route** for playback (`/api/rooms/[id]/playback` is GET-only).
- **DevTools bypass is ineffective:** a guest emitting `playback:*`/`queue:*` over the socket is rejected by the server host check; a guest pausing their *local* iframe affects only their own client (they get reconciled back / can reload) and never the room anchor.
- **UI** exposes zero playback controls to guests (read-only native player; Skip host-only).

## 5. Realtime impact
- Feature 4 flows entirely through the existing realtime path: `playback:skip` → server advance → `playback:stateChanged` (+ `playback:nextTrack`) broadcast to `room:{id}` → all clients reconcile and load the next track together (or drain to idle). Idempotent advance (advance-lock + "only if ended item is still current") is reused — duplicate/temporal races converge.
- Features 1, 3, 5 emit/consume **no** realtime events (client-local).

## 6. Sync impact
- **Untouched.** Position is still computed from the server anchor + clock offset (`computeExpectedPosition`); guests follow via the unchanged drift-reconcile loop; the host drives via native controls → existing `playback:*` commands.
- Feature 3 specifically **preserves** sync on mobile: because the player is no longer unmounted, the clock offset, reconcile interval, and anchor subscription persist across tab switches (previously they were lost on every switch).
- Feature 1's auto-unmute only flips the local mute flag; it never seeks, re-anchors, or alters server state.

## 7. Testing performed

| Check | Command | Result |
|-------|---------|--------|
| Types | `tsc --noEmit` | ✅ exit 0 |
| UI tests (jsdom) | `vitest run tests/ui` | ✅ **13 passed** (5 files) |
| Unit tests (node) | `vitest run tests/unit` | ✅ **53 passed** (9 files) |
| Lint | `next lint --dir src` | ✅ No warnings or errors |
| Build | `next build` | ✅ all 15 routes compiled (`/room/[roomId]` 48.5 kB / 185 kB First Load) |

> Run `tests/ui` and `tests/unit` **as separate invocations**. Passing both as positional args in one `vitest run tests/ui tests/unit` intermittently fails to apply the `environmentMatchGlobs` jsdom env to the UI files ("document is not defined") — a vitest quirk, not a product issue. Integration tests (`tests/integration`) need a live Postgres+Redis and were not run here; they exercise the server layer, which is unchanged.

**Manual browser verification recommended** (no real YouTube iframe in jsdom):
1. Join a playing room → video autoplays; sound on automatically where the browser allows, else one tap/interaction enables it.
2. Mobile: switch Player↔Queue↔Chat↔People → audio never stops; returning to Player shows the in-sync frame.
3. As guest: native controls are read-only; emitting `playback:play`/`skip` from DevTools is rejected.
4. As host: **Skip** advances all clients to the next track simultaneously; skipping the last track → Idle ("Nothing playing").
5. "Up Next" shows the queued-but-not-started count (current track excluded).

---

# Follow-up changes (round 2)

Two further requests, both verified (typecheck ✅, UI 13 + unit 53 ✅, lint ✅, build ✅):

## F6 — Lock the video for EVERYONE (host included)

**Root cause.** `controls:0` only hides YouTube's control *bar*; clicking the iframe still toggles play/pause. So guests (and the host) could still pause the video by clicking it. The previous model also let the host *drive* via native controls.

**Change (per explicit request: "remove all video-related functions, including the host's").** The player is now a **pure, non-interactive follower** for everyone:
- `controls:0, disablekb:1` for all clients **plus a transparent click-blocker overlay** (`absolute inset-0 z-[2]`) over the iframe — no one can play/pause/seek by clicking the video. Clicks still bubble to `window`, so first-gesture unmute keeps working; the overlay sits below the unmute button (z-10) and error overlay (z-20).
- Removed the host's native play/pause/seek → command emission and host seek-detection. Playback is now **fully server-driven**: autoplay on join, auto-advance on end, and the host's queue **Skip**. A reconcile guard re-asserts `playVideo()` if the video is ever found paused while the server says playing, enforcing "can't pause".
- **Kept** the two HOST-only *background* reports (not user interactions): `reportDuration` and the `trackEnded` auto-next accelerator (host resolved live from the store → no remount on transfer).
- `PlaybackPanel` simplified — the player is no longer role-keyed (behavior is identical for all roles), so `YouTubePlayer` takes no props.

**Impact.** Engine/protocol/sync unchanged. There is now **no manual play/pause/seek** for anyone (by design) — control is autoplay + auto-advance + host Skip. Server host-guards remain (defense in depth). Files: `src/features/youtube/components/YouTubePlayer.tsx`, `src/components/PlaybackPanel.tsx`.

## F7 — Align the current track's duration with waiting rows

**Root cause.** In the **host** view, waiting rows reserve layout space for the hover "remove ✕" button, but the pinned current row renders no button — so the current track's duration sat ~40 px further right and didn't line up.

**Change.** `QueueItem` now reserves a consistent `h-8 w-8` action slot on every host row (the current row gets an empty slot instead of the remove button), so the duration column aligns across all rows. Guests already aligned (no action slot anywhere). File: `src/components/queue/QueueItem.tsx`.

## Test harness fix (incidental)
`tests/ui/*` relied on the deprecated `environmentMatchGlobs` to select jsdom, which applied **nondeterministically** ("document is not defined" on some runs). Added a `// @vitest-environment jsdom` pragma to each UI test file — now `vitest run` reliably runs UI tests in jsdom (66 non-integration tests pass deterministically). Integration tests still require a live Postgres+Redis.
