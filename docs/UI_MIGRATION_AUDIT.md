# UI_MIGRATION_AUDIT.md — V1 (MMMuzik.fe) Frontend Audit

> **Phase 1 deliverable.** A complete, read-only audit of the V1 reference frontend
> at `D:\Learning\MMMuzik\MMMuzik.fe`. V1 is the **source of truth for UI / UX /
> layout / flows / screens / components / visual interactions / missing user-facing
> features**. This document describes *what exists in V1* — it makes no change
> proposals (those live in `UI_GAP_ANALYSIS.md` and `UI_MIGRATION_PLAN.md`).
>
> **Scope note:** V1's *transport* (SignalR, .NET hub) and data layer are documented
> only to the depth needed to know what each screen consumes/emits. Per the project
> objective, V1 architecture/transport will **NOT** be ported — V2 keeps Socket.IO,
> its server-authoritative engines, stores, DB, and Docker.

---

## 0. Stack snapshot

| Aspect | V1 (MMMuzik.fe) |
|---|---|
| Framework | **Next.js 14** (App Router, RSC), React 18 |
| Styling | Tailwind 3 + **shadcn/ui** (Radix primitives) + `tailwindcss-animate` |
| Tokens | **HSL CSS variables** (`globals.css`), dark-first, optional `.light` theme |
| Theme | `next-themes` (`attribute="class"`, `defaultTheme="dark"`, system disabled) |
| Icons | **lucide-react** |
| Toasts | **sonner** (`bottom-center`) |
| State | Zustand (per-feature stores) |
| Realtime | **SignalR** (`@microsoft/signalr`) — *not* Socket.IO |
| Font | **Inter** (`next/font`, CSS var `--font-sans`) |
| Structure | Feature-based: `src/features/{room,playback,queue,chat,participants}/{components,hooks,services,store,types}` + `src/components/{ui,feedback,layout}` + `src/lib` |

V1's feature folder shape is **the same** as V2's — easing migration mapping.

---

## 1. Routes / Sitemap

| Route | File | Renders | Purpose |
|---|---|---|---|
| `/` | `app/page.tsx` | `HomeHero` + `FeatureCards` (RSC composition) | Landing — create or join (via **dialogs**) |
| `/join/[code]` | `app/join/[code]/page.tsx` | `JoinRoomPanel code={code}` | Invite target: room summary + nickname capture |
| `/room/[roomId]` | `app/room/[roomId]/page.tsx` | `RoomExperience roomId={roomId}` | The live shared listening experience |

- Public, unauthenticated. No `/create` route — **create is a dialog on `/`**.
- **Invite links resolve to `/join/[code]`** (not `/room/...`).
- Join-by-code from Home validates the code, then routes to `/join/[code]`.

---

## 2. Layout / Shell

- **Root layout** (`app/layout.tsx`): Inter font (`--font-sans`), `ThemeProvider` (dark default, system off, `disableTransitionOnChange`), `<Toaster />` (sonner). `<body class="min-h-dvh bg-background font-sans">`. Viewport `themeColor #0d0d14`, `viewportFit: cover`.
- **`Logo`** (`components/layout/Logo.tsx`): triple-dot motif (primary/accent/success) + "MMMuzik" wordmark. Props `href?`, `size sm|md|lg`, `showWordmark`.
- **`Panel`** (`components/layout/Panel.tsx`): the shared column surface — `surface-panel`, flex column, `min-h-0 overflow-hidden`. Props `title`, `meta` (count beside title), `action` (right header slot), `icon`, `flush` (no body padding), `bodyClassName`. **Every room column (Participants / Queue / Chat) is a `Panel`.**

---

## 3. Home screen (`/`)

Top → bottom: **aurora backdrop** → **header** (`Logo` + "Listen together, in sync.") → **`HomeHero`** → **`FeatureCards`** → footer ("No account needed. Just a nickname. · Built with Next.js · MMMuzik").

**`HomeHero`** — `lg:grid-cols-[1.05fr_0.95fr]`:
- Left: a pill (`SoundBars` + "Real-time listening rooms"); H1 "Listen to music **together**, in real time." (*together* uses `.text-gradient-brand`); paragraph; CTA row = **`CreateRoomCard`** + **`JoinRoomCard`**; social proof (4 overlapping gradient avatars + "**2,400+** sessions started this week").
- Right (`hidden lg:block`): a decorative static "now-playing" preview card (artwork tile, "Now playing · in sync" + `SoundBars`, "Blinding Lights / The Weeknd", 36% progress "1:12 / 3:20", two mock chat lines).

**`FeatureCards`** — 3 cards (`sm:grid-cols-2 lg:grid-cols-3`): `Radio` **In perfect sync** / `ListMusic` **A shared queue** / `MessagesSquare` **Chat in real time**, each gradient icon tile + title + body.

**Create-room flow** (`CreateRoomCard` + `useCreateRoom`):
1. Hero button **"Create a room"** (`Plus`, `size=lg`) opens a Radix **`Dialog`**.
2. Dialog: `Radio` icon + "Create a room"; desc "Start a session and invite friends with a link. You'll be the host."
3. Fields: **Room name** (autofocus, "Friday Vibes", maxLength 40), **Your nickname** ("DJ Duy", maxLength 24). Inline `text-destructive` error.
4. Submit **"Create & enter room"** / "Creating…" (disabled while pending).
5. `createRoom(name, nickname)` → persists nickname → `POST /api/rooms {name, hostNickname}` → persists `Room` → routes to `/room/{room.id}`. Error: "Couldn't create the room. Try again."

**Join-by-code flow** (`JoinRoomCard` + `useJoinRoom`):
1. Hero button **"Join a room"** (`LogIn`, `variant=secondary`) opens a `Dialog`.
2. Field: **Room code** (autofocus, "7QK-2MD", centered `tracking-[0.3em]`, maxLength 7) — **live-formatted** by `formatRoomCode` (uppercase, strip non-alnum, hyphen `ABC-123`).
3. Submit **"Continue"** / "Checking…" (disabled until cleaned length ≥ 4).
4. `validateCode` → `GET /api/rooms/{code}` → routes to `/join/{code}`. Errors mapped by `joinErrorMessage` (404 → "This room doesn't exist or has closed.", 429 → rate limit, transport → "Couldn't reach the server…").

---

## 4. Join screen (`/join/[code]`)

**`JoinRoomPanel`** — centered `max-w-md` column on `bg-aurora`, `Logo href="/"`. Drives `useJoinRoom(code)` which loads the summary on mount. Three states:
- **Loading**: `surface-panel` + `Spinner` + "Looking up the room…".
- **Error**: destructive `AlertTriangle` tile, "Room not found", mapped message, "Back to Home".
- **Loaded**: **`RoomInfoCard`** + a `surface-panel` wrapping **`NicknameForm`** + caption "No account needed — your nickname is your identity in the room."

**`RoomInfoCard`** (`RoomSummary`): aurora header, `Headphones` gradient tile, "YOU'RE JOINING" eyebrow, room **name**, a row with a `Badge` showing **code** + "**{listenerCount}** listening" (`Users`). If `nowPlayingTitle`: footer "Now playing **{title}**" (`Music2`). (`hostName` is in the type but not rendered.)

**`NicknameForm`**: single **Your nickname** field (autofocus, "Pick a name to join as", maxLength 24, `aria-invalid`/`aria-describedby`). Enter submits. Button **"Join Room"** (`ArrowRight`) / "Joining…".

**Join flow** (`join(nickname)`): trims (error "Enter a nickname to join."), `session.setNickname`, `POST /api/rooms/{code}/join {nickname}` → `{roomId, sessionId, nickname, isHost}` (name backfilled from summary, `inviteUrl = /join/{code}`) → routes to `/room/{roomId}`. Duplicate nicknames auto-suffixed `(2)`.

**`InviteShare`** (used in the room header): two modes — `compact` (icon button, tooltip "Copy invite link") and full (code **chip** that copies the code + a "Copy link" button). Copy → `toast.success("Invite link copied"/"Room code copied")`; failure → `toast.error`. `copied` icon swaps `Copy→Check` for 1500ms.

---

## 5. Room screen (`/room/[roomId]`)

**`RoomExperience`** → `useRoom(roomId)` → renders **`RoomHeader`** + `<main>` → **`RoomLayout`**. Handles skeleton (`!isReady`) and closed states.

**`RoomHeader`**: backdrop-blurred bar — left `Logo (sm, no wordmark)` + divider + room **name** + `ConnectionBanner` (`hidden sm:inline-flex`); right `InviteShare` (code chip + "Copy link") + divider + ghost **Leave room** icon (`LogOut`, tooltip, hover→destructive).

**`RoomLayout`** — mounts **exactly one layout per breakpoint** (via `useBreakpoint`) so feature hooks run once:
- **Desktop ≥ 1024**: 3-col grid `[clamp(220px,18vw,280px) minmax(0,1fr) clamp(300px,24vw,360px)]`, `gap-3 p-3`. Col1 `ParticipantList` · Col2 `PlayerCard` over `QueueList` (`flex-1`) · Col3 `ChatPanel`.
- **Tablet 768–1023**: top row of two trigger buttons — **People** (opens left `Sheet` "Participants") and **Queue** (opens right `Sheet` "Queue"); below, 2-col grid `[minmax(0,1fr) 320px]` = `PlayerCard` + `ChatPanel`.
- **Mobile < 768**: shadcn **`Tabs`** (`defaultValue=player`), full-height content over a bottom `TabsList` of 4: **Player** (`Music2`) · **Queue** (`ListMusic`) · **Chat** (`MessageCircle`) · **People** (`Users`).

**`useBreakpoint`**: `matchMedia` tablet `(768–1023.98px)` / desktop `(≥1024px)` / else mobile; SSR default `desktop`, corrected on mount.

---

## 6. Playback UI (`features/playback`)

> V1's *real transport* is the **native YouTube iframe controls** (host only). The custom `PlaybackControls` and `PlaybackProgress` components **exist but are not wired into `PlayerCard`**; their Shuffle/Repeat buttons are inert.

- **`PlayerCard`** (the stage): `usePlayback(roomId)`. Empty state `EmptyState` "Nothing playing / Add a song to the queue to start the session." With a track: `YouTubePlayer` (keyed `host|guest`) + `NowPlaying` (artwork hidden for YouTube). **Escape-hatch row**: "Can't play here?" + **"Open on YouTube"** (`ExternalLink`) + **"Retry"** (`RotateCw`, in-place reload via `reloadKey`).
- **`NowPlaying`**: artwork (or gradient + `Music2`), provider `Badge` ("YouTube"/"Spotify"), green status = `SoundBars` + **"In sync"** (hard-coded text), title (`h2`, truncated), artist (muted, truncated).
- **`YouTubePlayer`**: one persistent `YT.Player`; `playerVars` `autoplay:1, mute:1, controls: isHost?1:0, disablekb: isHost?0:1, modestbranding:1, rel:0, playsinline:1, origin`. Always starts **muted**; unmute on first global pointer/keydown OR **"Tap to unmute"** corner button (`Volume2`). **Loading poster** `<img>` (`artworkUrl` or `i.ytimg.com/.../hqdefault.jpg`) until ready. Host terminal errors (`100/101/150`) → `onEnded()` auto-advance.
- **Sync** (V1's approach, descriptive only — *not to be ported*): server anchor `{positionMs, serverTimestampUtc, isPlaying}`; NTP clock offset (5 pings, min-RTT, every 15s); reconcile loop seeks only when `|drift| > 500ms` and `>2s` since last seek; host native play/pause/scrub captured → commands; `HOST_ACTION_GRACE 2500ms`.
- **`PlaybackControls`** (unused): host-gated transport — Shuffle (inert), Previous, Play/Pause (`shadow-glow` `icon-lg`), Next, Repeat (inert), Volume slider. Non-host → disabled + Tooltip **"Only the host can control playback"**.
- **`PlaybackProgress`** (unused): accessible Radix `Slider` (`aria-label="Seek"`, step 1000) + `tabular-nums` `m:ss / m:ss` timestamps; `canSeek` prop gates it.

**Affordances absent in V1:** explicit mute toggle (only unmute), restart-from-zero, working shuffle/repeat.

---

## 7. Queue UI (`features/queue`)

- **`QueueList`**: a `Panel` (title "Queue", `ListMusic`, `meta="{n} up next"`, `action=<AddSongDialog>`, `flush`). Empty → `EmptyState` "Queue's empty / Add the first song to get the room going." Else `ScrollArea` of `QueueItem`s.
- **`QueueItem`**: position number **or** `SoundBars` when current; `h-10 w-10` artwork (or `Music2`); title (`text-primary` if current); subtitle "Now playing" or "**{artist} · added by {addedByName}**"; duration (`tabular-nums`); host-only **Remove** `X` (hover/focus-revealed, `aria-label`). Current row `bg-primary/10 ring-primary/30`. Mount `animate-slide-in`.
- **`AddSongDialog`**: Radix `Dialog` (trigger = **"Add song"** + `Plus`, `size=sm`). Title "Add a song" (`ListPlus`); desc "Paste a YouTube or Spotify link. It'll be added to the end of the queue for everyone." One field **Song link** (autofocus, decorative `Youtube` icon, placeholder "https://youtube.com/watch?v=…  or  open.spotify.com/track/…"). Auto-detects provider (`detectProvider`, Spotify regex else YouTube). Submit **"Add to queue"** / "Adding…". Inline error "Couldn't add that link — check it's a valid YouTube/Spotify URL." `toast.success("Added to the queue")` on success. **Any participant** can add.
- **Not present in V1 UI:** reorder/drag (only inbound `QueueReordered` event), clear-all. Loading skeleton absent (fetch errors swallowed).

---

## 8. Chat UI (`features/chat`)

- **`ChatPanel`**: `Panel` ("Chat", `MessageCircle`, `flush`) → `MessageList` + `MessageInput`.
- **`MessageList`**: `ScrollArea`, `aria-live="polite"`, **autoscroll** to a bottom sentinel on new messages. Empty → `EmptyState` "No messages yet / Say hi 👋 and react to what's playing."
- **`ChatMessage`** (user): `flex items-end gap-2.5`, **own messages `flex-row-reverse` (right-aligned)**. `Avatar h-7` (image or gradient initials). Name shown **only for others**; timestamp always (`formatClock`, `text-[10px] tabular-nums`). Bubble `rounded-2xl px-3 py-2`: **self = `bg-primary text-primary-foreground` (rounded-br-md)**, **others = `bg-surface-2` (rounded-bl-md)**, `max-w-[78%]`. Failed → `AlertCircle` + "Failed to send · tap to retry" (retry **not wired**). **No host marker in chat.** System messages supported by type (centered chip) but **not produced** by the mapper.
- **`MessageInput`**: `<form>` (Enter-to-send), `Input` placeholder "Message the room…", icon **Send** (`SendHorizonal`, `aria-label`, disabled when empty). **No maxLength.** No optimistic insert (server echoes `MessagePosted`).

---

## 9. Participants UI (`features/participants`)

- **`ParticipantList`**: `Panel` ("Participants", `Users`, `meta="{onlineCount} online"`, `flush`) → `ScrollArea` of `ParticipantCard`. When ≤ 1 participant, a bottom **"alone" `EmptyState`** ("You're the only one here / Share the room link to listen together.") appears *below* the list.
- **`ParticipantCard`**: `Avatar h-9` (image or gradient initials) with an **overlaid presence dot** (bottom-right, `border-surface`) — `online` green / `idle` amber / `offline` muted (only online/offline produced today); name (truncated) + "(you)" for self; **`HostBadge`** at row end when host.
- **`HostBadge`**: `Badge variant="accent"` = `Crown` + "Host" (text + icon, color isn't the only signal).
- **No per-participant actions** (no kick/promote/transfer UI). Ordering = insertion order. Host transfer arrives inbound (`HostChanged`).

---

## 10. Shared UI primitives (`components/ui` — shadcn)

`avatar · badge · button · dialog · input · label · scroll-area · separator · sheet · skeleton · slider · sonner · tabs · tooltip`. `cn()` = `twMerge(clsx)`.

- **Button** (cva): **7 variants** `default`(primary+`shadow-glow`+`active:scale-[0.98]`)·`secondary`·`outline`·`ghost`·`destructive`·`success`·`link`; **6 sizes** `default·sm·lg·icon·icon-sm·icon-lg(rounded-full)`. `asChild` via Slot.
- **Badge** (cva): **6 variants** `default·accent·success·secondary·outline·destructive`, consistent `/15` tint fill. No sizes.
- **Sheet** sides `top·bottom(rounded-t-2xl)·left·right` (`w-3/4 sm:max-w-sm`), overlay `bg-black/70 backdrop-blur-sm`, open 300ms / close 200ms.
- **Tabs**: pill `TabsList` (`bg-surface p-1`), `flex-1` equal triggers, active `bg-primary text-primary-foreground`.
- **Slider**: track `bg-surface-2`, range `bg-primary`, thumb hidden until hover/focus.
- **Skeleton**: `animate-pulse rounded-lg bg-surface-2` (opacity pulse, not shimmer).
- Others: Dialog (full set + `X`), Input (`h-11 rounded-xl bg-surface-2`), Label, ScrollArea (custom thumb), Separator, Tooltip (`bg-popover`), Avatar.

`utils.ts` also exports `formatDuration`, `formatClock`, `formatRelativeTime`, `initials`, `avatarGradient` (8 gradients), `uid`, `formatRoomCode`.

---

## 11. Feedback components (`components/feedback`)

- **`ConnectionBanner`**: reads `connectionStore`; `null` when connected/idle; reconnecting/connecting → accent pill `Wifi` + `animate-pulse-ring` + "Reconnecting…"; disconnected → destructive pill `WifiOff` + "Disconnected". `role=status aria-live=polite`.
- **`EmptyState`**: `{icon, title, description, action}` — centered, `h-12 rounded-2xl bg-surface-2` icon tile, `text-sm` title, `text-xs` desc (`max-w-[34ch]`), optional action.
- **`SoundBars`**: 3 `animate-equalizer` bars, staggered `0.18s` delays; collapses to `h-1` when `playing=false`. `aria-hidden`.
- **`Spinner`**: `Loader2 animate-spin`, `role=status`, `sr-only` label.
- **`RoomSkeleton`** (`features/room`): full 3-column skeleton mirroring the live shell (header, participants rows, player + queue, chat bubbles).
- **`Toaster`** (sonner): `bottom-center`, themed (`bg-surface`, `shadow-panel`, `rounded-xl`).

---

## 12. Design tokens (V1 — HSL CSS variables, dark-first)

`globals.css` defines `:root, .dark` and an opt-in `.light`. Tailwind maps each to `hsl(var(--token))`.

| Token | Dark HSL | Role |
|---|---|---|
| `--background` | `240 18% 7%` | app canvas (near-black, violet tilt) |
| `--surface` / `--surface-2` | `240 14% 11%` / `240 12% 15%` | cards/panels / elevated (inputs, hover) |
| `--foreground` / `--muted-foreground` | `240 20% 97%` / `240 8% 64%` | primary / secondary text |
| `--border` / `--input` | `240 10% 20%` / `240 10% 18%` | |
| `--primary` | **`258 90% 66%`** | **violet brand** (actions, play, active) |
| `--accent` | **`326 84% 64%`** | **magenta** (presence/links/host badge) |
| `--success` | `142 71% 45%` | green ("in sync" / online) |
| `--destructive` | `0 72% 55%` | remove/leave/errors |
| `--ring` / `--radius` | `258 90% 66%` / `0.85rem` | focus / radius base |

- **Radius scale**: `sm = r−4` · `md = r−2` · `lg = r` · `xl = r+4` · `2xl = r+8`.
- **Shadows**: `glow` (primary halo, on primary button) · `panel` (used by `.surface-panel`, dialog, sheet, toast).
- **Brand utilities**: `.bg-aurora` (3 radial gradients), `.text-gradient-brand` (violet→magenta text), `.surface-panel`, `.scrollbar-thin`.
- **Animations** (`tailwind.config.ts`): `fade-in`, `slide-in`, `pulse-ring`, `equalizer`, accordion; plus `tailwindcss-animate` data-state classes (dialog/sheet/tooltip). `prefers-reduced-motion` fully honored.
- Font: Inter; `font-feature-settings: cv11, ss01`.

---

## 13. UX rules, empty/error states, motion, a11y (from `UI_UX_DESIGN.md`)

- **Host clarity**: host badge everywhere; non-hosts see playback controls **disabled + tooltip** ("Only the host can control playback"), **not hidden**.
- **One-tap share**: copy link → toast; code always visible/selectable.
- **Add-to-queue is universal**; show who added; new items animate in at the tail.
- **Real-time feedback**: lightweight join/leave toasts; "X is now host" on failover; non-blocking "reconnecting…" banner.
- **Empty states**: Queue "add the first song" · Chat "say hi 👋" · Participants "you're the only one here — share the link" · Player "nothing playing — add a song".
- **Error states**: invalid/expired code · track resolve failed (inline on add) · player load failed (host can skip) · chat send failed + retry · disconnect banner · **room closed → full-screen + Back to Home** · 5xx toast.
- **Autoplay**: require a user gesture; "Tap to join the sound" if blocked.
- **Motion**: 150–200ms ease-out; track-change art crossfade; respect `prefers-reduced-motion`.
- **A11y**: keyboard reachable, visible focus ring, `aria-label` on icon buttons, `aria-live` chat, color never the only signal, WCAG AA on dark.

---

## 14. Per-screen data needs (intent + shape only — backend NOT to be copied)

| Screen | Consumes | Emits / actions |
|---|---|---|
| Home | — (social proof/preview are static mocks) | `POST /api/rooms {name, hostNickname}`; `GET /api/rooms/{code}` (validate) |
| Join `[code]` | `GET /api/rooms/{code}` → `RoomSummary {id, code, name, listenerCount, hostName, nowPlayingTitle?}` | `POST /api/rooms/{code}/join {nickname}` → `{roomId, sessionId, nickname, isHost}` |
| Room | SignalR hub `/hubs/room`: `JoinRoom`, `Ping`; snapshots via REST (`/playback`, `/queue`, `/participants`, `/messages`) | `LeaveRoom` + `POST /api/rooms/{roomId}/leave` |
| Playback | `PlaybackState {track, isPlaying, positionMs, serverTimestampUtc, volume}`; broadcast `PlaybackStateChanged(state, currentItemId)` | host: `Play/Pause/Seek/NotifyTrackEnded/ReportDuration`; `RequestState`, `Ping` |
| Queue | `GET /queue` → `QueueItemDto[]`; events `TrackAddedToQueue/TrackRemoved/QueueReordered` | `AddTrack(roomId, provider, urlOrId)`, `RemoveTrack(roomId, itemId)` |
| Chat | `GET /messages` → `ChatMessageDto[]`; event `MessagePosted` | `SendMessage(roomId, body)` |
| Participants | `GET /participants` → `ParticipantDto[]`; events `ParticipantJoined/Left/HostChanged` | — (read-only) |

> **Anti-patterns visible in V1 (do NOT reproduce in V2):** hardcoded build-time `NEXT_PUBLIC_*` localhost URLs (`lib/env.ts`); persisting full `Room` incl. `selfId`/`isHost` to `localStorage` (no whoami endpoint); silently swallowed snapshot errors (`.catch(()=>{})`); inert Shuffle/Repeat buttons.

---

## 15. Inventory checklist (the 15 audit dimensions)

1. **Screens** — Home, Join(`[code]`), Room. (+ Room-closed full-screen, Join error/loading.)
2. **Routes** — `/`, `/join/[code]`, `/room/[roomId]`.
3. **Layouts** — root (theme+toaster), `Panel`, `RoomLayout` (3 breakpoint layouts), `Logo`.
4. **Reusable components** — `Panel`, `Logo`, `EmptyState`, `ConnectionBanner`, `SoundBars`, `Spinner`, `HostBadge`, all `components/ui/*`.
5. **Dialogs/modals** — `CreateRoomCard`, `JoinRoomCard`, `AddSongDialog` (Radix Dialog); tablet `Sheet`s (Participants/Queue).
6. **User flows** — Create&host · Join via link · Join via code · Host failover.
7. **Playback UI** — `PlayerCard`, `NowPlaying`, `YouTubePlayer`, (unused) `PlaybackControls`/`PlaybackProgress`; unmute, open-on-YouTube, retry, loading poster, "In sync".
8. **Queue UI** — `QueueList`, `QueueItem`, `AddSongDialog`; current highlight, added-by, host remove.
9. **Room UI** — `RoomExperience`, `RoomHeader`, `RoomLayout`, `RoomInfoCard`, `InviteShare`.
10. **Participant UI** — `ParticipantList`, `ParticipantCard`, `HostBadge`; presence dot, online count, "(you)".
11. **Responsive/mobile** — `useBreakpoint`; desktop 3-col · tablet sheets+2-col · mobile bottom-tabs; sticky player; `dvh`/safe-area.
12. **Animations** — `equalizer` (SoundBars), `slide-in` (queue), `fade-in`, `pulse-ring` (connection), dialog/sheet/tooltip transitions, aurora glow, gradient brand text, `active:scale`.
13. **Empty states** — Queue, Chat, Participants(alone), Player; `EmptyState` component.
14. **Loading states** — `RoomSkeleton`, `Spinner` (join), YT loading poster, button "…ing" labels.
15. **Error states** — invalid code, room-closed full-screen, add-track inline, player retry/open-on-YT, chat failed+retry, connection banner, 5xx toast.

---

*End of Phase 1 audit. Comparison & classification → `UI_GAP_ANALYSIS.md`. Sequenced work → `UI_MIGRATION_PLAN.md`.*
