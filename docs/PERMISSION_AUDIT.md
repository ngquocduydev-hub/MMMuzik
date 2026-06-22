# PERMISSION_AUDIT.md — Room Action Permissions & "Add Song" Investigation

> **Date:** 2026-06-22
> **Trigger:** Report — *"When a non-host user joins a room, the 'Add Song' UI is missing."*
> **Scope:** Full audit of the Add-Song flow + every room action's permission model (UI affordance **and** server enforcement), cross-checked against `SPEC.md`.
> **Verdict:** **No bug.** Add Song is correctly visible to **all** participants and the server authorizes **any** participant to add. The reported observation does **not** reproduce against the current code, and is already protected by a regression test. No code changes were required.

---

## 1. Current permission model

MMMuzik enforces permissions in **two independent layers**, exactly as `SPEC.md` REQ-SESS-6 requires ("Authority is enforced on every host-only action, not merely in the UI"):

| Layer | Where | Responsibility |
|-------|-------|----------------|
| **UI affordance** | `src/components/**`, `src/features/**` | Whether a control is *rendered* for the current user. A convenience layer only — never the security boundary. |
| **Server authority** | `src/server/services/**` | The real boundary. Every host-only command re-checks `isHost(room, sessionId)` against the **handshake-bound** session id and rejects guests, regardless of client state. |

**Host detection (single source of truth):**
- Domain: [`isHost(room, sessionId)`](../src/shared/domain/room.ts#L28) → `sessionId !== null && room.hostSessionId === sessionId`.
- UI mirror: [`QueueList.tsx:29`](../src/components/QueueList.tsx#L29) → `!!room && !!session && room.hostSessionId === session.id`.
- Identity is **bound at the socket handshake** (`socket.data.sessionId`), never read from a command payload — so a guest cannot impersonate the host by editing a request.

**Where "Add Song" lives:** the `<AddSongDialog />` is rendered in exactly one place — the Queue panel header action — and it is **not** wrapped in any `isHost` condition:

```tsx
// src/components/QueueList.tsx:47-64
action={
  <div className="flex items-center gap-2">
    {isHost && ( <Button ...skip>Skip</Button> )}   // host-only
    <AddSongDialog />                                // ALL participants — no gate
  </div>
}
```

Server side, [`addTrack`](../src/server/services/queueService.ts#L74) requires only an **active session + room membership** — explicitly *not* host:

```ts
// src/server/services/queueService.ts:74-83  ("Any participant can add.")
const room = await requireRoom(roomId);
if (!sessionId) throw new AppError(ERRORS.SESSION_REQUIRED, 'No active session');
const participant = await roomRepo.findParticipant(roomId, sessionId);
if (!participant) throw new AppError(ERRORS.SESSION_REQUIRED, 'Join the room first');
// ...resolve + append + broadcast — no host check
```

This matches **SPEC.md REQ-QUEUE-1**: *"**Any participant** can add a song."*

---

## 2. Bugs found

**None.** The investigation answered every question in the brief:

| # | Question | Answer |
|---|----------|--------|
| 1 | Is Add Song intentionally host-only? | **No.** It is intentionally available to all participants (SPEC REQ-QUEUE-1). |
| 2 | Is Add Song supposed to be visible to all? | **Yes** — host and guest alike. |
| 3 | Is the UI hidden because of role checks? | **No.** `<AddSongDialog />` has no `isHost` gate. |
| 4 | Is the UI hidden because of responsive rendering? | **No.** It renders in all three breakpoints (see §3). |
| 5 | Is the UI rendered but inaccessible? | **No.** Guests are real participants (`role: 'member'`), so the server accepts their `queue:add`. |
| 6 | Does reconnecting change behavior? | **No.** Reconnect re-pulls snapshots and recomputes `isHost`; Add Song never depends on it. |
| 7 | Does host transfer affect behavior? | **No.** Transfer flips Skip/Remove between users; Add Song stays visible to everyone before and after. |

---

## 3. Root cause (why the report did not reproduce)

There is no defect to root-cause. The current code already implements the expected behavior and is covered by a regression test:

```ts
// tests/ui/QueueList.test.tsx:99-106
it('hides host remove + skip for guests; the Add-song affordance is still present', () => {
  useRoomStore.getState().setSession({ id: 's-guest', ... });   // a GUEST
  ...
  expect(screen.queryByLabelText('Remove Song B from queue')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /skip current track/i })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /add song/i })).toBeInTheDocument(); // ✅ present for guest
});
```

**Most plausible explanations for the original observation** (UX perception, not bugs — *assumptions, flagged as such*):

1. **Tablet breakpoint (768–1023 px).** In `TabletLayout`, the Queue panel — and therefore the Add Song button — lives inside a slide-out **Sheet** behind a "Queue" button ([`RoomLayout.tsx:68-78`](../src/components/RoomLayout.tsx#L68)). A non-host on a tablet-width window sees no inline Add Song button until they open the Queue sheet. This is identical for host and guest, but can read as "missing." (Desktop shows it inline; mobile shows it under the "Queue" tab.)
2. **Comparing host vs. guest views side by side.** The host's Queue header has an *extra* **Skip** button next to Add Song; the guest's has only Add Song. Seeing fewer controls in the guest header can be misread as "the add control is gone" when Skip is the only thing actually absent.
3. **Stale build / pre-rebuild screenshot.** The UI was rebuilt on 2026-06-20; an observation from before that may not reflect current code.

---

## 4. Files modified

**None — no code change was necessary.** Files **reviewed** during the audit:

| File | Role in the flow | Finding |
|------|------------------|---------|
| [`src/components/QueueList.tsx`](../src/components/QueueList.tsx) | Renders `<AddSongDialog />` + host Skip | Add Song ungated ✅ |
| [`src/components/queue/AddSongDialog.tsx`](../src/components/queue/AddSongDialog.tsx) | The dialog + `queue:add` emit | No role check; open to all ✅ |
| [`src/components/queue/QueueItem.tsx`](../src/components/queue/QueueItem.tsx) | Per-row remove "X" | `canEdit` (host) only ✅ correct |
| [`src/components/RoomLayout.tsx`](../src/components/RoomLayout.tsx) | Desktop/Tablet/Mobile layouts | Queue (with Add) present in all 3 ✅ |
| [`src/components/layout/Panel.tsx`](../src/components/layout/Panel.tsx) | Header `action` slot | Always renders the action ✅ |
| [`src/server/services/queueService.ts`](../src/server/services/queueService.ts) | `addTrack` + host guards | Add = any participant; remove/reorder/clear/skip = host ✅ |
| [`src/server/services/playbackService.ts`](../src/server/services/playbackService.ts) | play/pause/seek | Host-only (`PLAYBACK_FORBIDDEN`) ✅ |
| [`src/server/services/chatService.ts`](../src/server/services/chatService.ts) | `sendMessage` | Any participant ✅ |
| [`src/server/socket/handlers/*.ts`](../src/server/socket/handlers/) | Command wiring | Identity from handshake, not payload ✅ |
| [`src/shared/domain/room.ts`](../src/shared/domain/room.ts) | `isHost` | Single source of truth ✅ |
| [`src/features/room/hooks/useRoomExperience.ts`](../src/features/room/hooks/useRoomExperience.ts) | Join + reconnect hydration | Re-pulls room/session on reconnect ✅ |
| [`src/features/room/services/realtimeService.ts`](../src/features/room/services/realtimeService.ts) | `presence:hostChanged` | Updates `hostSessionId` reactively ✅ |

---

## 5. Final permission matrix

Legend — **UI**: control is rendered for that role. **Server**: command is authorized for that role (the real boundary). "—" = no UI affordance by design.

| Action | Host UI | Guest UI | Host (server) | Guest (server) | Server enforcement | SPEC |
|--------|:------:|:------:|:------:|:------:|--------------------|------|
| View queue | ✅ | ✅ | ✅ | ✅ | read snapshot | REQ-QUEUE-* |
| View playback | ✅ | ✅ | ✅ | ✅ | read snapshot | §6 |
| View participants | ✅ | ✅ | ✅ | ✅ | read snapshot | REQ-PRES-* |
| View chat | ✅ | ✅ | ✅ | ✅ | read history | REQ-CHAT-3 |
| Send chat | ✅ | ✅ | ✅ | ✅ | `sendMessage` — any participant | REQ-CHAT-1 |
| **Add song** | ✅ | ✅ | ✅ | ✅ | `addTrack` — **any participant** | **REQ-QUEUE-1** |
| "Open on YouTube" / Retry | ✅ | ✅ | ✅ | ✅ | client-only fallback | REQ-YT-8 |
| Remove queued song | ✅ | ❌ | ✅ | ❌ `QUEUE_FORBIDDEN` | `removeTrack` → `requireHost` | REQ-QUEUE-5 |
| Remove current track | ❌ | ❌ | ❌ `QUEUE_CANNOT_REMOVE_CURRENT` | ❌ | guarded for everyone — skip instead | REQ-QUEUE-6 |
| Skip | ✅ | ✅ | ✅ | ✅ | `skip` → `requireParticipant` (any member) | see note ⬇ |
| Play | — | — | ✅ | ❌ `PLAYBACK_FORBIDDEN` | `playbackPlay` → host | REQ-PLAY-1 |
| Pause | — | — | ✅ | ❌ `PLAYBACK_FORBIDDEN` | `playbackPause` → host | REQ-PLAY-1 |
| Seek | — | — | ✅ | ❌ `PLAYBACK_FORBIDDEN` | `playbackSeek` → host | REQ-PLAY-1 |
| Reorder queue | — | — | ✅ | ❌ `QUEUE_FORBIDDEN` | `reorderQueue` → host | REQ-QUEUE-8 |
| Clear queue | — | — | ✅ | ❌ `QUEUE_FORBIDDEN` | `clearQueue` → host | (host-only) |
| Report duration / track-ended | — | — | ✅ | ❌ (silently ignored) | host-only background reports | §7.7 |
| Transfer host / close room | host action | ❌ | ✅ | ❌ | room service | REQ-HOST-2 / ROOM-7 |

> **Update (2026-06-22):** **Skip is now available to all participants** (was host-only). The server check moved from `requireHost` → `requireParticipant`; the UI shows Skip to everyone. The remove "X" stays host-only. See [`QUEUE_CHAT_SKIP_IMPROVEMENTS.md`](./QUEUE_CHAT_SKIP_IMPROVEMENTS.md) (Feature 4). Rows above reflect this change; older prose in this doc that calls Skip "host-only" predates it.

**Notes on the "—" rows (intentional, not bugs):**
- **Play / Pause / Seek have no UI for anyone.** Per the 2026-06-20 rebuild the embedded YouTube player is fully locked (`controls: 0, disablekb: 1` + a click-blocker overlay): playback is a synced radio (autoplay + auto-advance + host **Skip**). The host-only `play/pause/seek` *server* handlers remain as **defense-in-depth** and for future use.
- **Reorder / Clear have no UI** — removed for V1 visual parity; the host-only server commands remain available via the API.

---

## 6. Verification results

All commands run from repo root on 2026-06-22 (Prisma client generated first via `prisma generate`).

| Gate | Command | Result |
|------|---------|--------|
| Typecheck | `tsc --noEmit` | ✅ **Pass** (exit 0) |
| Lint | `eslint "src/**/*.{ts,tsx}"` | ✅ **Pass** (exit 0) |
| Tests (unit + UI) | `vitest run tests/unit tests/ui` | ✅ **71 passed** / 15 files |
| Production build | `prisma generate && next build` | ✅ **Compiled successfully**; 15 routes generated |

> Integration tests (`tests/integration`) require a live Postgres + Redis and were **not** run in this session (no change to integration-covered code). The relevant guest-add path is covered by `tests/integration/queue.service.test.ts` and the guest UI path by `tests/ui/QueueList.test.tsx`.

**Directly relevant test:** `tests/ui/QueueList.test.tsx` → *"hides host remove + skip for guests; the Add-song affordance is still present"* — passes, asserting the exact behavior in question.

---

## 7. Conclusion & recommendation

Add Song is **not** missing for non-hosts. It is rendered for every participant in every layout, the server authorizes any participant to add (matching SPEC REQ-QUEUE-1), and host-only playback/queue-management actions remain correctly restricted at both the UI and the server. The product requirements in the brief are **already met**:

- ✅ Add Song visible for all participants
- ✅ Guests can open the Add Song dialog
- ✅ Guests can submit YouTube links (`queue:add` accepted server-side)
- ✅ Queue updates remain server-authoritative (full-snapshot broadcast)
- ✅ Realtime synchronization unchanged
- ✅ Host-only playback restrictions still enforced

**If the report persists in practice,** capture: (a) viewport width (to distinguish the tablet-Sheet case), (b) whether the user successfully *joined* (a failed join shows the skeleton/fallback, hiding the whole room, not just Add Song), and (c) a screenshot — and re-file with those details. No code change is warranted on the current evidence.
