# UI_MIGRATION_ANALYSIS.md — V2 ⟶ UI_V1_REFERENCE.md

> **Task.** Rebuild the V2 UI to match `docs/UI_V1_REFERENCE.md` (the single source of
> truth) at ≥95% visual parity, **UI-only**, preserving 100% of architecture (App
> Router, TypeScript, Zustand, Socket.IO, playback/queue engines, Prisma, Docker, API
> contracts, business logic).
>
> **Honest baseline.** V2's UI was already migrated toward this exact V1 design in prior
> passes (see `VISUAL_PARITY_REPORT_AFTER.md`), so the large majority of the reference is
> **already implemented**. This analysis compares the reference against V2's *current*
> state and isolates the **true residual gaps** to close — it does not re-list work
> already done as "missing."

---

## 1. Screens in the reference (§4) → V2 status

| Screen | Reference | V2 status |
|---|---|---|
| Home `/` (hero, preview card, social proof, features, footer) | §4.1 | ✅ Implemented (`app/page.tsx`, `HomePreviewCard`) |
| Create Room dialog | §4.2 | ✅ `room/CreateRoomDialog.tsx` |
| Join Room dialog | §4.3 | ✅ `room/JoinRoomDialog.tsx` |
| Join page `/join/[code]` (loading/error/success, RoomInfoCard, NicknameForm) | §4.4 | ✅ `room/JoinRoomPanel.tsx`, `RoomInfoCard.tsx`, `NicknameForm.tsx` |
| Room `/room/[roomId]` (skeleton, closed, ready) | §4.5 | ✅ `RoomLayout.tsx`, `room/RoomSkeleton.tsx` |
| Playback view (PlayerCard) | §6 | ✅ `PlaybackPanel.tsx` + `playback/*` (see §4 below for the one decision) |
| Queue view | §7 | ✅ `QueueList.tsx`, `queue/*` |
| Mobile (tabs) / Tablet (sheets) | §10 | ✅ layout exists; ⚠️ tablet sheet chrome differs (gap T1) |

**All 3 routes exist** (`/`, `/join/[code]`, `/room/[roomId]`) and match the reference's navigation model.

## 2. Components in the reference (§5) → V2 status

Present & aligned: `Button`, `Badge`, `Input`, `Dialog`, `Sheet`, `Tabs`, `Avatar`, `Slider`, `ScrollArea`, `Tooltip`, `Toaster`, `Skeleton`, `Label`, `Separator`, `Logo`, `CreateRoomDialog`, `JoinRoomDialog`, `NicknameForm`, `RoomInfoCard`, `RoomHeader`, `InviteShare`, `ConnectionBanner`, `Panel`, `PlayerCard`(=`PlaybackPanel`), `NowPlaying`, `YouTubePlayer`, `QueueList`, `QueueItem`, `AddSongDialog`, `ChatPanel`, `MessageList`, `MessageInput`, `ParticipantList`, `ParticipantCard`, `HostBadge`, `EmptyState`, `Spinner`, `SoundBars`, `HomePreviewCard`.

Design system (§2): HSL tokens, violet/magenta/green, `bg-aurora`, `text-gradient-brand`, `surface-panel`, `shadow-glow/panel`, Inter, radius `0.85rem`, animations (`fade-in`, `slide-in`, `pulse-ring`, `equalizer`) — **all present and value-matched** (verified in `VISUAL_PARITY_AUDIT.md` at 100%).

## 3. Missing components in V2

| Component | Reference | Gap |
|---|---|---|
| **System chat message** (centered chip for joins/leaves/host transfer) | §5.12 "ChatMessage → two shapes: System / User"; §8.5 | ❌ V2's `ChatMessage` only renders the **user** shape. No system chip. |

No other reference component is absent.

## 4. UI differences (current V2 vs reference)

| # | Area | Reference says | V2 currently | Action |
|---|---|---|---|---|
| **D1** | Presence feedback (§5.14, §8.5) | join/leave/host-change appear as **system chat chips**; **only 3 toasts** total (copy code, copy link, added-to-queue) | fires **toasts** for join/leave/host-change (4–6 toasts) | **Fix:** remove those 3 toasts; render them as system chat chips |
| **T1** | Tablet sheets (§10.2) | People/Queue open in Sheets that render the panels **with borders/shadow stripped**, under a visible Sheet title | sheets show the full bordered `surface-panel` + `sr-only` title | **Fix:** add visible `SheetTitle`; render panels "bare" inside sheets |
| **C1** | Room-closed (§4.5) | DoorClosed **icon tile** + heading + subtext + Back to Home | heading + subtext + Back to Home, **no icon** | **Fix:** add DoorClosed icon tile |
| Player controls (§6.2 / §5.15 / Appendix A.2) | V1 *shipped* code uses **native YouTube controls**; the custom transport bar exists but is **unmounted** | V2 renders the **custom transport + seek + volume** bar (violet glow play button, host-gated, hidden-until-hover slider) | **Keep as-is** — see decision below |

### Player-controls decision (documented, not a gap)
The reference flags this as an explicit **"V2 decision point"** (§5.15) and notes the design mockup (`UI.png`, the ROOM PAGE frames) shows a **custom transport bar** — which is exactly what §5.15's `PlaybackControls`/`PlaybackProgress` describe (violet `icon-lg` play with `shadow-glow`, host-gated via disabled+tooltip, hidden-until-hover slider thumb). V2 already implements that look. Switching to native YouTube controls would (a) look *less* like the `UI.png` mockup and (b) require rewiring how host commands originate — touching the playback command path, which the task forbids ("do not modify playback synchronization logic"). **Therefore V2 keeps its custom controls**, which satisfy §5.15's "intended look" for the custom-bar path. This was also the user's standing Option-B decision.

## 5. New functionality required

1. **System chat chips** (the only net-new feature): synthesize ephemeral, client-side system messages from the **existing** realtime presence/host events (`presence:participantJoined/Left`, `presence:hostChanged`) and render them as centered chips in the chat stream. **No backend, schema, socket-contract, or sync change** — it consumes events V2 already receives and replaces the (reference-incorrect) presence toasts.

## 6. Known limitations (cannot reach without forbidden engine/schema changes — documented, not faked)

| Item | Reference | Why deferred |
|---|---|---|
| Idle / amber presence dot | §5.13 (`online`/`idle`/`offline`) | V2 presence is binary (`isOnline`); an "idle" signal would need a realtime/engine change (forbidden). Renders online/offline only. |
| Per-message "Failed to send · tap to retry" | §5.12 | V2 chat is ack-confirmed (not optimistic); a failed bubble needs an optimistic-send rework of the chat flow. Send failures surface as an error toast instead. |
| Spotify artwork in NowPlaying | §6.3 | V2 implements only the YouTube provider (matches V1 — "no Spotify player"); YouTube hides artwork (video is the art). |

## 7. Estimated implementation effort

| Item | Effort | Risk |
|---|---|---|
| D1 + missing system-chat component + new functionality (store `systemEvents`, `ChatMessage` system variant, `MessageList` merge, rewire `realtimeService`) | **M** (~1–2 h) | Low–Med (UI layer only; chat store extended additively so existing tests hold) |
| T1 tablet sheets (`bare` prop on `Panel`/`ParticipantList`/`QueueList`, visible `SheetTitle`) | **S** | Low |
| C1 room-closed icon | **S** | Low |
| Verification + test updates (`MessageList`/`ChatPanel`/chat-store tests) | **S** | Low |

**Total: ~half a day.** Everything is JSX/`className`/client-store only. No engine, schema, socket-contract, or service file is touched.

**Projected parity after these fixes: ~96%** (residual <4% = the three documented data/engine-bound limitations in §6).

---

*Proceeding to implementation (D1/new-feature → T1 → C1 → verify → `UI_MIGRATION_RESULT.md`).*
