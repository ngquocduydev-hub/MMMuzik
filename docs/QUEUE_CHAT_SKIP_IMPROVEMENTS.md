# QUEUE_CHAT_SKIP_IMPROVEMENTS.md

> Four UX improvements to the room experience. The **playback-sync engine, clock
> synchronization, Socket.IO architecture, server-authoritative playback, and
> server-authoritative queue were NOT modified.** The only server change is a
> permission predicate on `skip` (explicitly requested by Feature 4); every mutation
> stays server-authoritative and every realtime event is unchanged.

---

## Verification (all green)

| Check | Command | Result |
|-------|---------|--------|
| Types | `tsc --noEmit` | ✅ exit 0 |
| Lint | `eslint "src/**/*.{ts,tsx}"` | ✅ exit 0 |
| Unit + UI | `vitest run tests/unit tests/ui` | ✅ **86 passed** (16 files) |
| Integration | `vitest run tests/integration` (live Postgres+Redis via `docker compose up -d postgres redis` + `prisma migrate deploy`) | ✅ **49 passed** (5 files) |
| Build | `next build` | ✅ all 15 routes compiled |

---

## 1. Root cause analysis

| # | Feature | Root cause of the current behavior |
|---|---------|------------------------------------|
| 1 | **Queue shows ~5 items** | On desktop the middle column stacks the player over the queue; the queue was a plain `flex-1` with no floor, so once the (tall) player took its share the queue collapsed to 1–2 visible rows and scrolled almost immediately. There was no guaranteed minimum height for the list. (Tablet/mobile already give the queue a full sheet/tab, so they were fine.) |
| 2 | **Chat notifications** | New messages flowed straight into the store and rendered in the chat view, but there was **no unread state**. On mobile, chat is a *tab* (hidden unless selected), so a message arriving while you were on Player/Queue/People gave zero feedback. |
| 3 | **Queue progress** | The queue row only ever rendered `formatMs(item.durationMs)` — the static total. There was a server-authoritative expected-position hook (`useExpectedPosition`) but it wasn't wired into the queue row, so the current track showed only its duration, not "position / duration". |
| 4 | **All users can skip** | `skip()` called `requireHost(...)` and the UI gated the Skip button behind `isHost`, so guests could neither see nor invoke it — a deliberate host-only rule that the new product requirement reverses. |

---

## 2. Files modified

### Feature 1 — Queue shows ~5 items
| File | Change |
|------|--------|
| `src/components/RoomLayout.tsx` (`DesktopLayout`) | Middle column is now `overflow-y-auto`; the player is wrapped `shrink-0` (never compresses/clips the 16:9 video); the queue wrapper gets `min-h-[22rem]` (≈ 5 × 56px rows + header) so it always shows the current track + several upcoming ones, and `flex-1` so it fills extra space on taller screens. The column scrolls only when a short viewport genuinely can't fit both. |

### Feature 2 — Chat notifications
| File | Change |
|------|--------|
| `src/features/chat/store.ts` | Added `unread: number` + `chatVisible: boolean` + `setChatVisible(visible)`. `append` bumps `unread` **only when chat is hidden** (deduped repeats don't count); `setChatVisible(true)` clears it; `reset` clears both. |
| `src/components/ChatPanel.tsx` | Accepts `visible` (default `true`); a `useEffect` reports it to the store so unread counting pauses while chat is on-screen and resets when reopened. |
| `src/components/RoomLayout.tsx` (`MobileLayout`) | Tabs are now **controlled** (`value`/`onValueChange`); the Chat tab shows a small animated unread **badge** + a primary-color highlight while you're on another tab; opening Chat clears it. `ChatPanel` receives `visible={tab === 'chat'}`. |

### Feature 3 — Queue shows playback progress
| File | Change |
|------|--------|
| `src/lib/format.ts` | New pure `formatTrackTime(positionMs \| null, durationMs)` — `"11:11 / 27:33"` for the current row, `"27:33"` for others, `"--:--"` when duration unknown; position is **clamped** to the duration. |
| `src/components/queue/QueueItem.tsx` | Current row renders a new isolated `<CurrentTrackTime>` that consumes the existing `useExpectedPosition()` (server-authoritative tick) and `formatTrackTime`; non-current rows render the duration via `formatTrackTime(null, dur)`. |
| *(reused, unchanged)* `src/features/playback/hooks/useExpectedPosition.ts` | The existing read-only tick (anchor + clock offset → `computeExpectedPosition`). **Not modified.** |

### Feature 4 — All users can skip
| File | Change |
|------|--------|
| `src/server/services/queueService.ts` | `skip()` no longer calls `requireHost`; it now requires **room membership** (`requireParticipant`, new shared helper — identity is the handshake-bound session). Refactored `addTrack` to reuse the same helper (DRY). Host-only `remove`/`reorder`/`clear` are unchanged. |
| `src/components/QueueList.tsx` | The Skip button is no longer wrapped in `isHost &&` — shown to everyone (still `disabled` when nothing is playing). The per-row **remove "X" stays host-only** (`canEdit={isHost}`). |
| `src/server/socket/handlers/queueHandlers.ts` | Updated the authority comment (add/skip = any participant; remove/reorder/clear = host). |

### Tests
| File | Change |
|------|--------|
| `tests/unit/format.test.ts` *(new)* | `formatMs` + `formatTrackTime` (all Feature-3 examples incl. clamping + unknown-duration). |
| `tests/unit/chat.store.test.ts` | Added 5 unread tests (counts when hidden, skips when visible, clears on open, dedupe doesn't bump, reset). |
| `tests/ui/QueueList.test.tsx` | Updated Skip expectations (now shown to guests) + new "position / duration for the current track only" test. |
| `tests/integration/queue.service.test.ts` | Added "any participant (guest) can skip" + "a non-participant cannot skip". |

---

## 3. Architecture impact

**None to the architecture.** No new layers, services, events, routes, schema, or dependencies. All work stays within the established seams:

- **Process split, package boundaries, ports** — untouched.
- **`computeExpectedPosition`** (pure domain) is *reused read-only* — no engine change.
- **`useExpectedPosition`** (existing hook) is *reused* — Feature 3 just renders its value in a new place.
- Feature 1 is pure CSS/layout. Feature 2 adds two fields + one action to an existing client store. Feature 4 swaps one authorization predicate in an existing use-case.
- UI still: pages compose · network in services · state in stores · the player is reconciled to server state. No network calls were added to stores.

---

## 4. Realtime impact

**Zero changes to realtime transport, events, or protocols.**

- **Skip** still travels over the existing `playback:skip` command → `skip()` use-case → existing broadcasts (`playback:stateChanged`, `playback:nextTrack`, then a full `queue:updated` snapshot). Only *who* is allowed to send it changed; the server still executes and broadcasts authoritatively, and all idempotency/ordering guards (`advanceIfCurrent` no-ops unless the ended item is still current) are intact. Queue integrity is preserved: advance → remove skipped item → recompact → full-snapshot broadcast (verified by integration tests).
- **Chat** unread is derived **client-side** from messages already delivered by the unchanged `chat:messagePosted` / history path. No new events, no extra emits, nothing on the wire — so it cannot spam or interrupt playback. Dedupe-by-id still holds (a repeat id bumps neither the list nor the unread count).
- **Queue progress** consumes the existing `playback:stateChanged` anchor already in the store — no new subscriptions or messages.

---

## 5. Sync impact

**None.** The synchronization engine, clock sync, and server-authoritative anchor are untouched.

- Feature 3's position is computed by the **same** function the renderer uses (`computeExpectedPosition(anchor, Date.now() + clockOffsetMs)`) via the existing `useExpectedPosition` hook. It only **reads** the anchor + clock offset and **never** uses the local player clock as truth, so every client shows the same position (within clock-offset accuracy) and the display can't perturb sync. Position is clamped to the duration for display only.
- Features 1, 2, 4 don't touch playback timing at all. Skip reuses `advanceIfCurrent` (the same anchor transition as auto-next and the server timer), so the post-skip anchor is identical regardless of who pressed it.

---

## 6. Permission changes

| Action | Before | After |
|--------|:------:|:-----:|
| Add song | any participant | any participant *(unchanged)* |
| **Skip** | **host only** | **any participant** ✅ |
| Remove queued track | host only | host only *(unchanged)* |
| Reorder / Clear queue | host only | host only *(unchanged)* |
| Play / Pause / Seek | host only | host only *(unchanged)* |

- Skip authorization moved from `requireHost` → `requireParticipant` (must be a member of the room; identity is bound at the socket handshake, never trusted from a payload). A non-participant is rejected with `session.required` (covered by a new integration test). Server remains the single authority.
- UI mirrors the rule: the Skip button is visible to everyone; the host-only remove "X" is unchanged.

---

## 7. Testing performed

**Automated (all green):** `tsc --noEmit` (0), `eslint` (0), `vitest run tests/unit tests/ui` (**86 passed**, 16 files), `vitest run tests/integration` against live Postgres+Redis (**49 passed**, 5 files), `next build` (15 routes; Tailwind emitted the new `min-h-[22rem]` + badge classes).

New / updated coverage:
- **Feature 3:** `formatTrackTime` unit tests (duration-only, position/duration, clamp-to-duration `27:33 / 27:33` and `1:25 / 1:25`, unknown-duration); UI test asserting the current row shows `11:11 / 27:33` while a queued row shows `4:15`.
- **Feature 2:** chat-store unit tests — counts while hidden, ignores while visible, clears on open, dedupe doesn't double-count, reset clears.
- **Feature 4:** integration tests — a guest can skip (advances + removes the current track), a non-participant is rejected; existing host-skip / advance / idempotency tests still pass.
- **Regression:** all prior unit/UI/integration suites pass unchanged.

**Manual verification recommended (not runnable headless here — no browser-automation tooling):**
- Feature 1: on desktop with a track playing, confirm ≈5 queue rows are visible before scrolling at various window heights; confirm tablet (Queue sheet) and mobile (Queue tab) show ≥5.
- Feature 2: on mobile, send a message from a second client while on the Player/Queue/People tab → the Chat tab shows an animated badge + highlight; opening Chat clears it; desktop/tablet (chat always visible) never badge.
- Feature 3: confirm the current row's position advances ~once per second and reads identically on two clients; paused freezes it; it clamps at the total near the end.
- Feature 4: as a guest, press Skip → the room advances for everyone immediately and the skipped track is removed.

> Postgres+Redis were started via `docker compose up -d postgres redis` and **left running** so the integration suite stays runnable (matches the established workflow). Integration env: `DATABASE_URL=postgresql://mmmuzik:mmmuzik@localhost:5432/mmmuzik REDIS_URL=redis://localhost:6379`.

---

## Notes / interpretations (flagged assumptions)

- **"~5 items"** is implemented as a *minimum* (`min-h-[22rem]`): always show the current track + several upcoming, and **more** when the screen is taller (mobile/tablet show many) — never fewer. This matches the goal ("immediately understand what's coming next") and the complaint ("too few / scrolls too early") without wasting a full mobile screen on only 5 rows.
- **Time format** reuses the app's existing `formatMs` (`11:11 / 27:33`, `0:30 / 4:15`) rather than introducing zero-padded minutes (`00:30`), to keep one consistent time format across the player and queue (the task examples are illustrative).
- **Chat badge scope:** the unread badge targets the mobile Chat **tab** (the only place chat is hidden). On desktop/tablet chat is a permanent column (`visible=true`), so it never accrues unread — the live messages are the notification. (A transient Queue/People *sheet* on tablet can briefly overlay the chat column; treating that as "hidden" was out of scope and left as-is.)
