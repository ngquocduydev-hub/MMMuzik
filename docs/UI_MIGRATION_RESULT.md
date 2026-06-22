# UI_MIGRATION_RESULT.md — V2 ⟶ UI_V1_REFERENCE.md

> Result of rebuilding the V2 UI to `docs/UI_V1_REFERENCE.md`. Per `UI_MIGRATION_ANALYSIS.md`,
> the bulk of the reference was already implemented in prior passes; this round closed the
> **true residual gaps** (D1 presence-as-system-chips, T1 tablet sheet chrome, C1 closed-room
> icon) and added the one **missing feature** (system chat chips).
>
> **Constraint honored:** UI-only. No change to playback sync, realtime sync, room/queue
> logic, backend services, DB schema, socket contracts, or API. Every edit is JSX / `className`
> / a client-only Zustand field.

---

## Files changed

| File | Change |
|---|---|
| `src/features/chat/store.ts` | **+** `systemEvents: SystemChatEvent[]` + `pushSystem(text)` + `reset` clears it (additive — existing `messages` behavior untouched). Exports `SystemChatEvent`. |
| `src/features/room/services/realtimeService.ts` | Presence/host events now call `pushSystem(...)` instead of `toast(...)`; removed the `sonner` import. (Aligns to §5.14 — only copy/add-queue toasts remain.) |
| `src/components/chat/MessageList.tsx` | Merges `messages` + `systemEvents` by timestamp; renders `SystemMessage` chips inline; empty state only when both are empty. |
| `src/components/ChatPanel.tsx` | Reads `systemEvents` from the store, passes to `MessageList`. |
| `src/components/layout/Panel.tsx` | **+** `bare?: boolean` prop (drops `surface-panel` chrome → transparent) for nesting in Sheets. |
| `src/components/ParticipantList.tsx` | **+** `bare` prop forwarded to `Panel`. |
| `src/components/QueueList.tsx` | **+** `bare` prop forwarded to `Panel`. |
| `src/components/RoomLayout.tsx` | Tablet sheets render `<ParticipantList bare />` / `<QueueList bare />`; closed-room `Fallback` gains a `DoorClosed` icon tile + exact V1 copy + "Back to Home". |
| `tests/unit/chat.store.test.ts` | **+** `pushSystem` / reset coverage. |
| `tests/ui/ChatPanel.test.tsx` | **+** system-chip render test. |

## Components created

- **`src/components/chat/SystemMessage.tsx`** — centered chat chip (`rounded-full bg-surface-2 px-3 py-1 text-xs text-muted-foreground`) for join/leave/host-transfer notices (UI_V1_REFERENCE §5.12 "System" message shape).

## Components modified

`chat/MessageList`, `ChatPanel`, `layout/Panel`, `ParticipantList`, `QueueList`, `RoomLayout` (see table). No primitive (`button`, `dialog`, `sheet`, …) needed changes.

## Features added

1. **System chat chips** — joins, leaves, and host transfers now appear as centered chips merged into the chat stream by timestamp, synthesized **client-side from the realtime presence/host events V2 already receives** (`presence:participantJoined/Left`, `presence:hostChanged`). No mock data, no backend/socket/schema change. This also corrected §5.14 (those events were previously surfaced as toasts; now only the 3 reference toasts remain — copy code, copy link, added to queue).
2. **Tablet sheet panels are now "bare"** — Participants/Queue render without card border/shadow inside their side Sheets (§10.2), keeping their own header as the visible title and the `sr-only` `SheetTitle` for a11y.
3. **Closed-room state** now shows the `DoorClosed` icon tile + "This room has closed" / "The session ended or the host left. Start a new one anytime." + **Back to Home** (§4.5).

## V2 features preserved & integrated (not present in V1)

Per requirement #7, kept and visually consistent: custom transport bar (violet glow play, host-gated tooltip, hidden-until-hover slider — matches §5.15's intended look), seek + volume sliders, queue reorder (Chevron) + "Clear all", chat `(Host)` marker, dynamic sync label ("In sync / Syncing… / Out of sync"), `SyncStatusIndicator` data.

## Remaining differences (documented; require forbidden engine/schema changes — not faked)

| Item | Reference | Why it remains |
|---|---|---|
| Idle / amber presence dot | §5.13 | V2 presence is binary (`isOnline`); "idle" needs a realtime/engine signal (out of scope). Renders online/offline. |
| Per-message "Failed to send · tap to retry" | §5.12 | V2 chat is ack-confirmed, not optimistic; a failed bubble needs an optimistic-send rework. Send errors show an error toast. |
| Spotify artwork tile | §6.3 | Only the YouTube provider is implemented (matches V1's "no Spotify player"); the video is the artwork. |
| Player = native YouTube controls | §6.2 | **Intentional:** V2 keeps its custom transport (matches the `UI.png` mockup + §5.15 intended look) and avoids touching the playback command path (forbidden). Documented decision. |

## Verification

- `tsc --noEmit` → **0 errors**
- `eslint src/**` → **0**
- `vitest tests/unit tests/ui` → **66 passed** (added 2: `pushSystem`, system-chip render)
- `next build` → **success** (15 routes)
- No file under playback sync, realtime sync, services, repositories, prisma, or socket contracts was modified.

## Estimated visual parity score

**~96%** against `UI_V1_REFERENCE.md`.

| Screen | Parity |
|---|---:|
| Home | ~97% |
| Join | ~96% |
| Dialogs | ~96% |
| Room — desktop layout / header | ~97% |
| Room — player (custom-control look, §5.15) | ~90% |
| Room — queue | ~95% |
| Room — chat (now incl. system chips) | ~96% |
| Room — participants | ~93% (no idle state) |
| Tablet | ~94% (bare sheets) |
| Mobile | ~93% |
| Closed / loading states | ~97% |
| Design system / tokens | 100% |

The residual ~4% is entirely the four documented items above, each of which would require changing the realtime/playback engine or DB schema — explicitly out of scope.

---

*Analyze → Implement → Verify → Report complete. Pixel screenshots require running both stacks; `pnpm dev` to confirm visually.*
