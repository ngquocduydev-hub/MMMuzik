# UI_REBUILD_PLAN.md — MMMuzik V2 Frontend Rebuild

> **Status:** Phase 1 (Analysis). Authoritative blueprint for the from-scratch rebuild of the V2 **presentation layer**, derived **exclusively** from [`UI_V1_REFERENCE.md`](./UI_V1_REFERENCE.md).
>
> **Scope rule.** Only the presentation layer (layouts, pages, components, styling, animations, interactions) is rebuilt. The engine is **frozen**: Zustand stores, services, hooks, Socket.IO contracts (`src/shared/events`), domain (`src/shared/domain`), Prisma, REST handlers, Docker, env. Rebuilt components must wire to the **exact** store/service/hook signatures documented in §9.
>
> **Source of truth precedence.** `UI_V1_REFERENCE.md` governs all visual/interaction/responsive decisions. Where V1 values reference V1-specific domain facts (e.g. room-code length), V2's domain constants win (V2 codes are 6 chars via `ROOM_CODE_LENGTH`).

---

## 0. Key architecture decision (resolved with user)

**Player control model = Faithful V1 (native YouTube controls).**

- V1 reference §6.2 / §5.15: the room has **no custom transport bar**. Playback uses **native YouTube iframe controls** — host gets `controls:1` (+ keyboard), guests get `controls:0, disablekb:1` (read-only). The player is **keyed by role** so a host↔guest transfer remounts it.
- The host's **native** play / pause / seek interactions become the room's authoritative commands, emitted over the **existing** socket events (`playback:play`, `playback:pause`, `playback:seek`). Guests follow the server anchor exactly as today.
- **Removed from the room UI:** the mounted custom transport row, the `PlaybackProgress` seek bar, the volume slider, and the "host controls playback" caption. (`PlaybackProgress.tsx` is retained in the tree but **unmounted**, matching V1's "exists but not mounted" convention.)
- **Unchanged:** the wire protocol, server handlers, sync engine math, drift reconcile, duration reporting, and auto-advance (`playback:trackEnded` / `playback:reportDuration`). The only behavioral change is **where host commands originate** (native player instead of custom buttons) — server/protocol/sync untouched.

---

## 1. Routes & pages (3 public routes, no auth)

| Route | File | Composition | Notes |
|-------|------|-------------|-------|
| `/` | `src/app/page.tsx` | Home: aurora canvas → header (Logo + tagline) → hero (badge · headline · paragraph · Create/Join CTAs · avatar social-proof · desktop preview card) → 3 feature cards → footer | Server component; CTAs are client dialogs. Ref §3.2, §4.1 |
| `/join/[code]` | `src/app/join/[code]/page.tsx` → `JoinRoomPanel` | Centered `max-w-md` on aurora: Logo → loading / error / success (RoomInfoCard + NicknameForm + helper) | Ref §3.3, §4.4 |
| `/room/[roomId]` | `src/app/room/[roomId]/page.tsx` → `RoomLayout` | Responsive room shell (closed / loading / ready) | Ref §3.4, §4.5 |
| (root) | `src/app/layout.tsx` | `<html class=Inter dark>` → ThemeProvider (locked dark) → children → Toaster (sonner, bottom-center) | Ref §3.1 |

There is **no shared nav/header/footer** component across routes — each screen builds its own. Navigation is via CTAs and the in-room header.

---

## 2. Layouts

### 2.1 Root shell (`layout.tsx`)
- `<html lang="en">` with Inter font var + `suppressHydrationWarning`; `color-scheme: dark` via globals.
- `ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange`.
- `<Toaster>` mounted once (sonner, themed dark, bottom-center).
- `viewport`: `themeColor #0d0d14`, `viewportFit=cover`, `width=device-width`, `initialScale=1`.

### 2.2 Home layout (`page.tsx`)
- `relative min-h-dvh overflow-hidden bg-background` + absolute aurora overlay (`top-0 h-[70vh] pointer-events-none`).
- Inner `mx-auto max-w-6xl px-5 sm:px-8 min-h-dvh flex-col`: header `py-6` · main `flex-1 justify-center gap-16` (hero grid `lg:grid-cols-[1.05fr_0.95fr]` + features `grid sm:grid-cols-2 lg:grid-cols-3 gap-4`) · footer `border-t py-6`.

### 2.3 Room shell (`RoomLayout`)
Owns lifecycle via `useRoomExperience(roomId)`; renders **one** of: error fallback · closed fallback (`DoorClosed`) · `RoomSkeleton` · ready (`flex h-dvh flex-col`: `RoomHeader` + `main flex-1 min-h-0` → breakpoint layout). Breakpoint chosen by `useBreakpoint()` (mounts exactly one layout).

| Breakpoint | Layout |
|-----------|--------|
| `desktop` (≥1024) | `grid grid-cols-[clamp(220px,18vw,280px)_minmax(0,1fr)_clamp(300px,24vw,360px)] gap-3 p-3`: Participants · (PlayerCard over QueueList `flex-1`) · Chat |
| `tablet` (768–1023) | `flex-col gap-3 p-3`: trigger row (People→left Sheet `w-80`, Queue→right Sheet `w-96`) then `grid-cols-[minmax(0,1fr)_320px]`: PlayerCard (`self-start`, scroll) + Chat |
| `mobile` (<768) | `Tabs flex-col h-full`: content `p-3` + bottom `TabsList m-3 grid grid-cols-4 rounded-2xl` (Player/Queue/Chat/People, icon-over-label). Default tab Player |

---

## 3. Component catalog (target state)

Legend: **K** keep as-is (already conformant) · **R** rebuild/replace contents · **N** new · **U** unmount (keep file, not rendered).

### 3.1 Shared primitives (`src/components/ui/*`) — all **K**
shadcn/ui on Radix, verified against ref §5.0: `button` (variants default/secondary/outline/ghost/destructive/success/link; sizes default/sm/lg/icon/icon-sm/icon-lg; `rounded-xl`, `shadow-glow` on default, `active:scale-[0.98]`), `badge` (default/accent/success/secondary/outline/destructive), `input` (`h-11 rounded-xl bg-surface-2`), `dialog` (overlay `bg-black/70 backdrop-blur-sm`, content `max-w-lg rounded-2xl p-6 shadow-panel`, zoom-95), `sheet` (side panels, 300/200ms), `tabs` (active `bg-primary text-primary-foreground shadow`), `tooltip`, `slider` (track `h-1.5`, thumb hidden-until-hover), `scroll-area`, `avatar`, `skeleton`, `separator`, `label`, `sonner`. **No changes required.**

### 3.2 Brand / layout primitives
| Component | Path | Action | Ref |
|-----------|------|--------|-----|
| `Logo` | `components/layout/Logo.tsx` | K | §5.1 — triple dot (violet/magenta/green) + wordmark, sizes sm/md/lg |
| `Panel` | `components/layout/Panel.tsx` | K | §5.9 — surface container, header (icon+title+meta+action), `flush`/`bare` |
| `UserAvatar` | `components/ui/user-avatar.tsx` | K | §5.0 Avatar — deterministic gradient + initials, sizes sm/md/lg |
| `SoundBars` | `components/feedback/SoundBars.tsx` | K | §5.14 — 3 bars, `animate-equalizer` staggered, collapse when paused |
| `EmptyState` | `components/feedback/EmptyState.tsx` | K | §5.14 |
| `Spinner` | `components/feedback/Spinner.tsx` | K | §5.14 |
| `ConnectionBanner` | `components/feedback/ConnectionBanner.tsx` | K | §5.8 — hidden when connected; magenta "Reconnecting…" / red "Disconnected" |
| `HostBadge` | `components/HostBadge.tsx` | K | §5.13 — accent Badge + Crown + "Host" |

### 3.3 Home
| Component | Path | Action | Ref |
|-----------|------|--------|-----|
| HomePage | `app/page.tsx` | R (re-author from §4.1; structurally already matches) | §4.1 |
| `CreateRoomDialog` | `components/room/CreateRoomDialog.tsx` | R | §4.2 — Radio icon; room name (maxLength **40**) + nickname (maxLength **24**); full-width "Create & enter room" |
| `JoinRoomDialog` | `components/room/JoinRoomDialog.tsx` | R | §4.3 — LogIn icon; code input center `text-lg tracking-[0.3em]`, auto-format `ABC-123`; "Continue" disabled until valid |
| `HomePreviewCard` | `components/room/HomePreviewCard.tsx` | K | §4.1 preview |
| `HeroIllustration` | `components/ui/HeroIllustration.tsx` | DELETE if unused (not referenced by §4.1; preview card is `HomePreviewCard`) | — |

### 3.4 Join screen
| Component | Path | Action | Ref |
|-----------|------|--------|-----|
| `JoinRoomPanel` | `components/room/JoinRoomPanel.tsx` | K | §4.4 |
| `RoomInfoCard` | `components/room/RoomInfoCard.tsx` | K | §5.5 |
| `NicknameForm` | `components/room/NicknameForm.tsx` | R (align nickname maxLength → **24**) | §4.4 |

### 3.5 Room shell
| Component | Path | Action | Ref |
|-----------|------|--------|-----|
| `RoomLayout` | `components/RoomLayout.tsx` | K (verify breakpoints) | §3.4, §8 |
| `RoomHeader` | `components/RoomHeader.tsx` | K | §5.6 |
| `InviteShare` | `components/InviteShare.tsx` | R (add documented `compact` Share2 variant for completeness) | §5.7 |
| `RoomSkeleton` | `components/room/RoomSkeleton.tsx` | R (drop transport-row placeholder; full-width grid, no `max-w` cap; align to native-controls player) | §4.5 |

### 3.6 Player subsystem — **the main rebuild**
| Component | Path | Action | Ref |
|-----------|------|--------|-----|
| `PlayerCard` | `components/PlaybackPanel.tsx` → rename concept to **PlayerCard** (keep file path to preserve imports) | **R** | §6 — aurora card; edge-to-edge 16:9 video; below-video meta `px-5 pb-5 sm:px-6 sm:pb-6`; NowPlaying; escape-hatch row; **no transport/seek/volume**; "Nothing playing" EmptyState when idle |
| `YouTubePlayer` | `features/youtube/components/YouTubePlayer.tsx` | **R** | §6.2/§6.6 — role-keyed; host `controls:1, disablekb:0` + emits play/pause/seek; guest `controls:0, disablekb:1` + follows; loading poster; "Tap to unmute" + global first-gesture unmute; error escape hatch |
| `NowPlaying` | `components/playback/NowPlaying.tsx` | R (add `showArtwork` branch for Spotify/no-video per §6.3) | §6.3 |
| `PlaybackProgress` | `components/playback/PlaybackProgress.tsx` | **U** (retained, unmounted) | §5.15 |

### 3.7 Queue
| Component | Path | Action | Ref |
|-----------|------|--------|-----|
| `QueueList` | `components/QueueList.tsx` | **R** (remove "Clear all"; Panel + Add song action; ScrollArea rows) | §7.1 |
| `QueueItem` | `components/queue/QueueItem.tsx` | **R** (remove up/down reorder chevrons — V1 has **no** reorder UI §7.5; keep host-only remove "X", hidden until hover, never on current) | §7.2–7.4 |
| `AddSongDialog` | `components/queue/AddSongDialog.tsx` | R (Youtube icon; "YouTube or Spotify" copy + dual placeholder) | §7.6 |

### 3.8 Chat
| Component | Path | Action | Ref |
|-----------|------|--------|-----|
| `ChatPanel` | `components/ChatPanel.tsx` | K | §5.12 |
| `MessageList` | `components/chat/MessageList.tsx` | K | §5.12 |
| `ChatMessage` | `components/chat/ChatMessage.tsx` | **R** (remove inline "(Host)" marker — not in V1 §5.12) | §5.12 |
| `SystemMessage` | `components/chat/SystemMessage.tsx` | K | §5.12 |
| `MessageInput` | `components/chat/MessageInput.tsx` | K | §5.12 |

### 3.9 Participants
| Component | Path | Action | Ref |
|-----------|------|--------|-----|
| `ParticipantList` | `components/ParticipantList.tsx` | K | §5.13, §8.2 |
| `ParticipantCard` | `components/ParticipantCard.tsx` | K (add `idle`→amber presence per §5.13 if store ever exposes it; currently online/offline only) | §5.13 |

---

## 4. Design system (already conformant — verify, do not churn)

`globals.css` + `tailwind.config.ts` already implement ref §2 exactly: HSL tokens (`--primary` violet `258 90% 66%`, `--accent` magenta `326 84% 64%`, `--success` green `142 71% 45%`, `--radius 0.85rem`), `.bg-aurora`, `.text-gradient-brand`, `.surface-panel`, `.scrollbar-thin`, `shadow-glow`/`shadow-panel`, keyframes `fade-in`/`slide-in`/`pulse-ring`/`equalizer`, reduced-motion guard, locked dark theme. **No changes planned.**

---

## 5. Responsive requirements (ref §2.7, §10)

- `useBreakpoint`: mobile `<768`, tablet `768–1023.98`, desktop `≥1024`; SSR default desktop, corrects via `matchMedia` on mount. **Keep.**
- All room layouts use `h-dvh`/`min-h-dvh` + `min-h-0` flex chains so internal panels scroll and header/tab-bar stay fixed over mobile chrome.
- Mobile: bottom tab bar (Player/Queue/Chat/People). Tablet: People/Queue as side Sheets, Player+Chat 2-col. Desktop: 3 columns.
- Header condenses below `sm` (hide divider, ConnectionBanner, "Copy link" label).

---

## 6. Animations (ref §9 — all already defined in tailwind config)

`fade-in` (0.2s), `slide-in` (0.18s, queue items), `pulse-ring` (2s, reconnecting Wifi), `equalizer` (0.9s, SoundBars staggered 0.18s). Dialog fade+zoom-95; Sheet slide 300/200ms; Tooltip fade+zoom; button `active:scale-[0.98]`; hover `transition-colors`; remove-"X" opacity reveal; skeleton `animate-pulse`. Reduced motion honored globally. **No new animations needed.**

---

## 7. Interactions (ref §4–§8)

- **Home CTAs** open modal dialogs (no inline forms). Create → `/room/[id]` as host. Join → validate code → `/join/[code]`.
- **Join** → nickname → `/room/[id]` as member. Enter submits.
- **Room player (native YT controls):** host scrubs/plays/pauses on the YouTube UI → emits `playback:*` commands; guests follow silently. "Tap to unmute" + first-gesture unmute. "Open on YouTube" / "Retry" escape hatch always available.
- **Queue:** anyone Adds (toast "Added to the queue"); host removes via hover-revealed "X" (not on current); current track highlighted + pinned. No reorder UI.
- **Chat:** Enter sends; field clears on ack success; autoscroll; system chips for join/leave/host-transfer.
- **Invite:** code chip copies code (green check + toast); "Copy link" copies invite URL.
- **Leave:** header LogOut → best-effort `leaveRoom` → `/`.
- **Toasts (only 3, ref §5.14):** "Room code copied", "Invite link copied" (+ copy-fail), "Added to the queue".

---

## 8. Accessibility (ref §11) — preserve
Focus-visible violet ring (global); `aria-label`s on all icon-only buttons; chat list `aria-live=polite`; ConnectionBanner/Spinner `role=status`; presence dot `title` + sr-only; HostBadge icon+text; form `aria-invalid`/`aria-describedby`; Enter submits all forms; decorative elements `aria-hidden`; host player keeps keyboard, guest disabled.

---

## 9. Frozen engine contracts (rebuilt UI MUST wire to these — do not alter)

**Stores** (`useRoomStore`, `usePlaybackStore`, `usePlayerStore`, `useQueueStore`, `useChatStore`, `useParticipantsStore`, `useConnectionStore`) — exact selectors/actions as in the codebase. Key reads used by UI:
- room: `room {id,code,name,status,hostSessionId,createdAt}`, `session {id,displayName,avatar}`, `isReady`, `closed`, `error`.
- playback: `playback {roomId,status,currentTrackId,currentVideoId,positionMs,updatedAtUtc,revision}`, `lastRttMs`, `clockOffsetMs`; `useExpectedPosition(): number`.
- player (local pref): `volume`, `muted`, `setVolume`, `setMuted`, `toggleMuted`.
- queue: `items: QueueItemDto[]`.
- chat: `messages`, `systemEvents`.
- participants: `participants: ParticipantDto[]`.
- connection: `status`.

**Hooks:** `useRoomExperience(roomId)` (lifecycle, side-effects only), `useExpectedPosition()`, `useBreakpoint()`.

**Services:** `roomApi` (`createRoom`, `joinRoom`, `leaveRoom`, `getRoom`, `getRoomSummary`, `getParticipants`, `getSession`).

**Socket events the UI emits** (`getSocket().emit(...)` with `ApiResponse` ack): `playback:play|pause|seek|skip|trackEnded|reportDuration`, `queue:add|remove|reorder|clear`, `chat:send`, `room:join|leave`. Host native-control wiring uses **only** `playback:play|pause|seek` + existing `trackEnded`/`reportDuration` (no protocol change).

**Helpers:** `formatMs`, `splitTrackTitle`, `formatClock`, `cn`, `avatarGradient`, `initials`, `formatRoomCode`, `cleanRoomCode`.

---

## 10. Execution order (Phase 3)
1. Player subsystem (YouTubePlayer role-split → PlayerCard → NowPlaying). *Highest risk; do first + typecheck.*
2. Queue (QueueItem, QueueList, AddSongDialog).
3. Chat (ChatMessage).
4. Home + Join (dialogs, NicknameForm, InviteShare, RoomSkeleton).
5. Cleanup (delete `HeroIllustration` if unused; confirm `PlaybackProgress` unmounted).
6. Verify: `tsc --noEmit` → `vitest run tests/unit tests/ui` → `next build`. Report in `UI_REBUILD_RESULT.md`.
