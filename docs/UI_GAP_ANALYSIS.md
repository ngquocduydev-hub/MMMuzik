# UI_GAP_ANALYSIS.md — V1 (MMMuzik.fe) vs V2 (MMMuzik-v2)

> **Phase 2 deliverable.** Item-by-item comparison of the V1 reference UI (per
> `UI_MIGRATION_AUDIT.md`) against V2's current frontend. V2's current UI is the
> one built earlier this session (Next.js 15 / Socket.IO / hand-rolled components
> + Tailwind hex tokens). Every item is classified:
>
> | Class | Meaning | Action |
> |---|---|---|
> | **A** | Already exists in V2, equivalent | None |
> | **B** | Exists but **different** | Re-style / re-flow to V1 |
> | **C** | **Missing entirely** in V2 | Build (using V2 architecture) |
> | **D** | **Better in V2** — keep V2 | Keep; do not regress to V1 |
>
> **Guardrails:** V2 architecture is untouchable — Socket.IO, server-authoritative
> playback/realtime/sync engines, Zustand stores, Prisma/Postgres/Redis, Docker.
> Where V1's data layer (SignalR, REST shapes) differs, the **UI binds to V2's
> existing socket events / REST / stores** — we never port SignalR or V1 services.

---

## 0. V2 baseline (current state, for reference)

- **Stack**: Next.js 15 (custom Node server), React 19, Socket.IO, Zustand, Tailwind 3, Zod, Prisma/Postgres/Redis, Inter (`next/font`).
- **Routes**: `/` (landing), `/create`, `/join` (generic code entry), `/room/[roomId]`.
- **Tokens**: hardcoded **hex** in `tailwind.config.ts` (`accent #7c44d2`, `accent-soft`, `bg`, `panel`, `elevated`, `border`, `online`, `danger`). **Dark only.**
- **Components**: `Brand`, `Avatar` (initials), `icons` (hand-rolled inline SVG set), `HeroIllustration`, `RoomLayout` (single responsive 3-col grid, stacks on mobile), `RoomHeader`, `ParticipantList`, `PlaybackPanel`, `QueueList`, `ChatPanel`, `ConnectionStatus`, `SyncStatusIndicator`, `LoadingState`, `YouTubePlayer`.
- **No**: shadcn/Radix, `next-themes`, `sonner`, `lucide-react`, `Panel`, `EmptyState`/`Skeleton` components, dialogs, sheets, tabs, tooltips.
- **Realtime/engine**: server-authoritative playback anchor + NTP clock sync + revision-gated reconcile; socket events `room:* playback:* queue:* chat:* presence:* system:ping/pong`; REST `/api/rooms[...]`, `/api/session`.

---

## 1. Foundation — design system, tokens, primitives

| # | Item | V1 | V2 now | Class | Notes / target |
|---|---|---|---|:--:|---|
| F1 | Token model | HSL CSS vars (`--primary` etc.), Tailwind `hsl(var())` | hardcoded hex in config | **B** | Adopt V1's HSL-var model so components consume tokens, never hex. |
| F2 | Brand color | violet `258 90% 66%` | violet `#7c44d2` (≈ same hue) | **A** | Equivalent; fold into the var. |
| F3 | Secondary **accent (magenta)** `326 84% 64%` | present | **absent** | **C** | Add `--accent` magenta (presence/links/host badge, gradient). |
| F4 | `success` / `online` green | `142 71% 45%` | `online #3fba68` | **A** | Equivalent → `--success`. |
| F5 | `destructive` / `danger` | present | `danger #f64855` | **A** | Equivalent → `--destructive`. |
| F6 | `surface` / `surface-2` / `card` / `popover` / `muted` tokens | full set | partial (`panel`,`elevated`) | **B** | Map/extend to V1's full token set. |
| F7 | **Light theme** + `next-themes` | optional `.light`, dark default | **dark only** | **C** | Add light token set + `ThemeProvider` (dark default). |
| F8 | Radius scale (`--radius .85rem`, 5-step) | yes | single feel | **B** | Adopt 5-step radius. |
| F9 | Shadows `glow` / `panel` | yes | partial (`shadow-panel`) | **B** | Add `glow`; align `panel`. |
| F10 | Brand utilities `.bg-aurora`, `.text-gradient-brand`, `.surface-panel` | yes | none (`scrollbar-thin` only) | **C** | Add utilities. |
| F11 | **shadcn/ui + Radix primitives** (button, badge, dialog, input, label, scroll-area, separator, sheet, skeleton, slider, sonner, tabs, tooltip, avatar) | full | **none** (hand-rolled) | **C** | Install shadcn primitive set (additive; no engine impact). |
| F12 | Icons | **lucide-react** | hand-rolled inline SVGs | **B** | Adopt `lucide-react` (superset; retire custom set). |
| F13 | **Toasts (sonner)** | yes, `bottom-center` | **none** | **C** | Add `<Toaster>` + `toast.*`. |
| F14 | Animations: `equalizer`, `slide-in`, `fade-in`, `pulse-ring`, dialog/sheet/tooltip, aurora, gradient text | rich | minimal (`spin`, color transitions) | **C** | Port keyframes + `tailwindcss-animate`. |
| F15 | `cn()` + formatters (`formatDuration`,`formatClock`,`initials`,`avatarGradient`,`uid`,`formatRoomCode`) | yes | partial (`format.ts`: `formatMs`,`splitTrackTitle`,`formatClock`) | **B** | Extend utils; add `formatRoomCode`, `avatarGradient`, `initials`. |
| F16 | Font Inter | yes | yes | **A** | — |

---

## 2. Screens, routes & navigation

| # | Item | V1 | V2 now | Class | Notes / target |
|---|---|---|---|:--:|---|
| N1 | Home `/` | landing with **Create/Join dialogs**, hero, social proof, preview card, feature cards | landing with hero + illustration + feature cards; create/join are **separate pages** | **B** | Re-flow: Create & Join become **dialogs on `/`** (V1 pattern). |
| N2 | `/create` route | **does not exist** (dialog) | exists (separate page) | **B/D** | Replace with `CreateRoomDialog`; retire/redirect `/create`. |
| N3 | `/join` generic page | n/a | exists (code + nickname) | **B** | Replace generic page with `JoinRoomDialog` on `/`. |
| N4 | **`/join/[code]`** (room summary + nickname) | **yes** | **no** (V2 has `/join?code=` prefill only) | **C** | Add `/join/[code]` route with `RoomInfoCard` + `NicknameForm`. |
| N5 | Invite link target | `/join/[code]` | `?code=` prefill on `/join` | **B** | Point invite links at `/join/[code]`. |
| N6 | `/room/[roomId]` | yes | yes | **A** | Route exists; layout differs (see §5). |
| N7 | Deep-link `/room` without session → `/join/[code]` | documented | not enforced | **C** | Add guard/redirect (minor). |

---

## 3. Layout / shell

| # | Item | V1 | V2 now | Class | Notes / target |
|---|---|---|---|:--:|---|
| L1 | Root: `ThemeProvider` + `Toaster` | yes | **neither** | **C** | Add both to `app/layout.tsx`. |
| L2 | `Logo` (triple-dot + wordmark, sizes) | yes | `Brand` (note + wordmark) | **B** | Re-style `Brand`→`Logo` look (or keep `Brand`, align visuals). |
| L3 | `Panel` shared surface (title/meta/action/icon/flush) | yes | ad-hoc panel markup per component | **C** | Add `Panel`; refactor columns onto it. |
| L4 | Room shell (`flex h-dvh`, header + main) | yes | yes (similar) | **A** | Equivalent. |

---

## 4. Home screen detail

| # | Item | V1 | V2 now | Class | Notes |
|---|---|---|---|:--:|---|
| H1 | Hero copy "Listen to music **together**, in real time" | yes, gradient *together* | yes, `accent-soft` *together* | **B** | Use `.text-gradient-brand`. |
| H2 | Hero illustration | static **preview card** (now-playing mock) on `lg` | custom **HeroIllustration** (SVG characters) | **B** | V1 uses a product-preview card, not characters. Decide: adopt preview card (closer to V1) — keep illustration as alt. |
| H3 | Social-proof avatars + "2,400+ sessions" | yes | none | **C** | Optional marketing block. |
| H4 | `SoundBars` "Real-time listening rooms" pill | yes | static dot pill | **B** | Swap to `SoundBars`. |
| H5 | Create flow | **dialog** (room name + nickname) | `/create` page | **B** | → `CreateRoomDialog`. |
| H6 | Join flow | **dialog** (formatted code) | `/join` page | **B** | → `JoinRoomDialog` + `formatRoomCode`. |
| H7 | FeatureCards (Radio/ListMusic/MessagesSquare) | 3 cards, specific copy | 3 cards, different copy/icons | **B** | Align icons + copy to V1. |

---

## 5. Room layout & header

| # | Item | V1 | V2 now | Class | Notes |
|---|---|---|---|:--:|---|
| R1 | Desktop 3-col grid (clamped rails) | `[clamp 220-280 · 1fr · clamp 300-360]` | `[260px · 1fr · 340px]` | **B** | Adopt clamped track. |
| R2 | **Tablet layout** (Participants/Queue in `Sheet`s + 2-col) | yes | none (stacks) | **C** | Add tablet breakpoint via `useBreakpoint` + `Sheet`. |
| R3 | **Mobile layout** (bottom **Tabs**: Player/Queue/Chat/People) | yes | single stacked column | **C/B** | Add tabbed mobile layout. |
| R4 | `useBreakpoint` (one layout mounted per breakpoint) | yes | none | **C** | Add hook. |
| R5 | RoomHeader (Logo, name, connection, share, leave) | yes | yes (Brand, name+code+copy, count, avatar, leave) | **B** | Align; add `InviteShare`. |
| R6 | **`InviteShare`** (code chip + Copy link + **toast**) | yes | copy-code button only (no toast) | **B/C** | Add copy-link + toast. |
| R7 | `ConnectionBanner` pill | yes (`pulse-ring`) | `ConnectionStatus` banner | **B** | Re-style to pill in header. |

---

## 6. Playback

| # | Item | V1 | V2 now | Class | Notes |
|---|---|---|---|:--:|---|
| P1 | **Server-authoritative engine** | yes | yes (anchor + NTP + revision-gate) | **D** | **Keep V2.** Do not port V1 sync. |
| P2 | Transport controls | **native YouTube controls** (host); custom bar **unused**; shuffle/repeat **inert** | **custom** play/pause/skip/restart + click-seek, **bound to socket commands**, host-only | **D** | **Keep V2** — bound-to-server controls beat native + inert buttons. Re-skin to V1 look. |
| P3 | Host-only gating with **tooltip** ("Only the host can control playback") | yes (disabled + Tooltip) | disabled + helper text | **B** | Add `Tooltip` on disabled controls. |
| P4 | `NowPlaying`: provider `Badge` + `SoundBars` + "In sync" | yes | title/artist + `SyncStatusIndicator` (rtt/offset) | **B/D** | Adopt provider badge + SoundBars "In sync" *look*; **keep** V2's real sync data as the source (V2 better — D). |
| P5 | Seek bar | Radix `Slider` (unused) | click-to-seek div | **B** | Re-style with `Slider` (accessible), keep server seek command. |
| P6 | Volume | native YT + unused slider | volume store + slider | **D/B** | Keep V2 store; re-skin. |
| P7 | YouTubePlayer embed + reconcile | yes | yes | **D** | Keep V2 engine. |
| P8 | **Loading poster** (`hqdefault.jpg` until ready) | yes | none (placeholder text) | **C** | Add poster (small UX win). |
| P9 | "Open on YouTube" + "Retry" escape hatch | yes | yes (on error) | **A** | Equivalent. |
| P10 | "Tap to unmute" | yes | yes | **A** | Equivalent. |
| P11 | Host **terminal-error auto-advance** (100/101/150) | yes | partial (error overlay; advance via ENDED) | **B** | Add terminal-error → skip for host. |
| P12 | Empty "Nothing playing" | yes | yes | **A** | Equivalent. |
| P13 | Shuffle / Repeat | **inert** buttons | disabled placeholders | **D** | Neither works; keep disabled (or hide). Not a real feature in V1. |

---

## 7. Queue

| # | Item | V1 | V2 now | Class | Notes |
|---|---|---|---|:--:|---|
| Q1 | Add track | **`AddSongDialog`** (Radix Dialog, 1 link field, toast) | inline form (input + Add) in panel | **B** | Move to `AddSongDialog` (V1 UX). |
| Q2 | Provider auto-detect (YouTube/**Spotify**) | yes (`detectProvider`) | YouTube only (`extractYouTubeId`) | **C** | Spotify add path missing — but **Spotify is out of V2 MVP** (SPEC). Defer; keep YouTube. |
| Q3 | QueueItem (artwork, current `SoundBars`, added-by, duration, host remove) | yes | thumbnail, title, artist/added-by, duration, host remove | **B** | Align styling; add `SoundBars` for current. |
| Q4 | **Reorder UI** | **none** (inbound event only) | **up/down arrows + `queue:reorder`** | **D** | **Keep V2** (V1 lacks it). |
| Q5 | **Clear queue** | none | host **Clear all** | **D** | **Keep V2.** |
| Q6 | Empty state | `EmptyState` "Queue's empty" | inline empty text | **B** | Use `EmptyState` component. |
| Q7 | Slide-in animation on add | yes | none | **C** | Add `animate-slide-in`. |
| Q8 | "Added by {name}" | yes | yes | **A** | Equivalent. |

---

## 8. Chat

| # | Item | V1 | V2 now | Class | Notes |
|---|---|---|---|:--:|---|
| C1 | Realtime chat (send/history/dedupe) | yes (SignalR) | **yes (Socket.IO, built this session)** | **A/D** | Functionally equivalent; **V2 keeps its Socket.IO slice.** |
| C2 | Message bubble style (own = primary right, others = surface-2 left, avatar) | yes | left-aligned rows, avatar, name+marker | **B** | Re-style to bubble layout. |
| C3 | **Host marker in chat** | **none** | **"(Host)"** | **D** | Keep V2 (improvement). |
| C4 | "(you)" self marker | n/a (own = right bubble) | "(you)" | **D/B** | Keep concept; reconcile with bubble style. |
| C5 | Autoscroll + `aria-live` | yes | yes | **A** | Equivalent. |
| C6 | Empty state "say hi 👋" | `EmptyState` | inline text | **B** | Use `EmptyState`. |
| C7 | MessageInput (Send icon, Enter-to-send) | yes (no maxLength) | yes (maxLength = `CHAT_MAX_LENGTH`) | **D** | Keep V2 maxLength (validation). |
| C8 | **System messages** (join/leave/host-change) | type supports, **unused** | none | **C** | Optional: emit system lines (needs realtime). |
| C9 | Failed-send + retry | UI present, **retry unwired** | none | **C** | Optional: add failed/retry (V1's is non-functional). |

---

## 9. Participants

| # | Item | V1 | V2 now | Class | Notes |
|---|---|---|---|:--:|---|
| PA1 | List + count | yes (`{n} online`) | yes (count) | **B** | Align "{n} online" meta. |
| PA2 | `ParticipantCard` (avatar + presence dot + name + "(you)" + `HostBadge` crown) | yes | avatar + name + (host badge OR dot) | **B** | Adopt presence dot **always** + `HostBadge` crown + "(you)". |
| PA3 | `HostBadge` (Crown + "Host") | yes | text badge "Host" | **B** | Add crown icon. |
| PA4 | Presence states online/idle/offline | online/offline produced | online/offline | **A** | Equivalent (idle unused in both). |
| PA5 | "Alone" empty footer | yes | empty list text | **B** | Add "You're the only one here — share the link." |
| PA6 | Per-participant actions (kick/promote) | **none** | none | **A** | Neither has it (out of scope). |

---

## 10. States & feedback

| # | Item | V1 | V2 now | Class | Notes |
|---|---|---|---|:--:|---|
| S1 | **`RoomSkeleton`** (full 3-col skeleton) | yes | `LoadingState` spinner | **C** | Add skeleton mirroring the shell. |
| S2 | `Spinner` (join lookup) | yes | `LoadingState` | **B** | Add `Spinner` component. |
| S3 | `ConnectionBanner` | yes | `ConnectionStatus` | **B** | Re-style. |
| S4 | `EmptyState` reusable component | yes | inline per feature | **C** | Add reusable `EmptyState`. |
| S5 | **Room-closed full-screen** + Back to Home | yes | `Fallback` "Room unavailable" | **B** | Align copy/visual (DoorClosed icon). |
| S6 | Invalid/expired code message | yes | join error inline | **B** | Align on `/join/[code]`. |
| S7 | **Toasts**: copy, join/leave, "X is now host" | yes | none | **C** | Add via `sonner` (needs presence/host events — V2 has them). |
| S8 | Track-resolve inline error | yes | yes (add error) | **A** | Equivalent. |

---

## 11. Animations & motion

| # | Item | V1 | V2 now | Class | Notes |
|---|---|---|---|:--:|---|
| M1 | `equalizer` SoundBars | yes | none | **C** | Add (now-playing + queue current + hero pill). |
| M2 | `slide-in` (queue/list enter) | yes | none | **C** | Add. |
| M3 | `pulse-ring` (connection) | yes | none | **C** | Add. |
| M4 | Dialog/Sheet/Tooltip transitions | via `tailwindcss-animate` | n/a (no primitives) | **C** | Comes with shadcn install. |
| M5 | Aurora glow / gradient brand text | yes | none | **C** | Add utilities. |
| M6 | `prefers-reduced-motion` honored | yes | partial | **B** | Add the media-query reset. |

---

## 12. Functional / backend gaps (UI-driven, build with V2 architecture)

These are user-facing features in V1 that need **more than CSS** in V2. Implement using V2 architecture (REST route + service + socket event + store), never SignalR.

| # | Feature | Need | Class | V2 implementation sketch |
|---|---|---|---|---|
| FN1 | **Room summary by code** (for `/join/[code]` pre-join card) | **Backend** (REST) | **C** | Add `GET /api/rooms/by-code/[code]` → `{id, code, name, listenerCount, nowPlayingTitle?}` reusing `findRoomByCode` + participant count + playback. (Read-only; no engine change.) |
| FN2 | **Invite-link copy + toast** | UI + clipboard | **B** | `InviteShare` uses existing `room.code`; build invite URL `/join/{code}`; `sonner` toast. |
| FN3 | **Join/leave + host-change toasts** | Realtime (events exist) | **C** | Subscribe to existing `presence:participantJoined/Left` + `presence:hostChanged`; fire `toast`. No backend change. |
| FN4 | **System chat messages** (join/leave) | Realtime + (maybe) persistence | **C** (optional) | Either client-only ephemeral system lines from presence events, or a server `system` message kind. Recommend client-only first (no DB change). |
| FN5 | **Spotify add** | Backend + playback adapter | **C** (deferred) | Out of V2 MVP scope (SPEC). Keep YouTube-only; leave provider seam. |
| FN6 | **Theme toggle (light)** | UI + tokens | **C** | `next-themes` + `.light` token set + a toggle (optional; dark stays default). |
| FN7 | **Deep-link guard** `/room` w/o session → `/join/[code]` | UI/routing | **C** | Redirect when no persisted membership/session. |

> Everything else (playback commands, queue add/remove/reorder/clear, chat send, presence) **already has V2 socket events + REST + stores** — UI rebinds to them; **no new backend**.

---

## 13. Summary tally

| Class | Count (approx) | Examples |
|---|---|---|
| **A — equivalent** | ~14 | Inter font, brand hue, success/danger, escape-hatch, unmute, autoscroll, room route, added-by |
| **B — different, re-style/re-flow** | ~30 | tokens→HSL, icons→lucide, home dialogs, room layout, header/share, NowPlaying look, queue dialog, chat bubbles, participant card, skeleton/empty styling |
| **C — missing, build** | ~25 | shadcn primitives, sonner, next-themes/light, `Panel`/`EmptyState`/`Skeleton`, tablet sheets, mobile tabs, `/join/[code]`, room-summary-by-code, toasts, animations, loading poster |
| **D — V2 better, KEEP** | ~10 | server-authoritative engine, socket-bound transport controls, queue reorder, queue clear, chat host marker, chat maxLength, real sync data |

**Headline:** No V1 *capability* is missing from V2's engine — the gaps are **presentational + flow + design-system**, plus a small set of **additive, read-only/realtime UI features** (room-summary-by-code, toasts, tabs/sheets, skeletons). V2 is strictly ahead on playback-control binding, queue management, and chat correctness — those stay.

---

*Sequenced, risk-ordered work plan → `UI_MIGRATION_PLAN.md`.*
