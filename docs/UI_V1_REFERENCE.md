# UI_V1_REFERENCE.md — MMMuzik Frontend (V1)

> **Purpose.** This is the **complete UI/UX reference** for MMMuzik V1. It documents *only* the user-facing experience — screens, layout, styling, components, interactions, animations, and user journeys — in enough detail that another project (**V2**) can reproduce the **exact same look, feel, layout, and flow** without reading the original source code.
>
> **Scope.** UI/UX only. No business logic, no backend, no database, no realtime/sync internals — those appear only where they are *visible to the user* (e.g. "the player follows a server clock" → user sees an "In sync" indicator).
>
> **Source of truth.** Reverse-engineered from the actual implemented frontend in `MMMuzik.fe/src/` (Next.js App Router + TailwindCSS + shadcn/ui + Radix). Where the older design spec (`MMMuzik.fe/UI_UX_DESIGN.md`) disagrees with the code, **the code wins** and the divergence is flagged. Reference mockup board: `MMMuzik.fe/UI.png`.
>
> ⚠️ **Two important V1 realities** (both differ from the older spec):
> 1. **Brand accent is VIOLET + MAGENTA, not Spotify-green.** Green is retained only as a *success / "in sync" / online* signal. The reference image and `globals.css` are authoritative.
> 2. **The live room has NO custom transport bar.** Playback is driven by **YouTube's native iframe controls** (host gets them enabled; guests get a read-only player). The `PlaybackControls` and `PlaybackProgress` components exist in the codebase but are **not mounted** in the room UI. See [§6](#6-playback-ui).

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Design System](#2-design-system)
3. [Layout Structure](#3-layout-structure)
4. [Screen Inventory](#4-screen-inventory)
5. [Component Catalog](#5-component-catalog)
6. [Playback UI](#6-playback-ui)
7. [Queue UI](#7-queue-ui)
8. [Room Experience](#8-room-experience)
9. [Animations](#9-animations)
10. [Mobile Experience](#10-mobile-experience)
11. [Accessibility](#11-accessibility)
12. [Screenshots Mapping](#12-screenshots-mapping)

---

# 1. Product Overview

MMMuzik is a **real-time collaborative music-listening web app**. Users create or join a **room**, share a code/link, and everyone listens to the same track in sync while building a shared queue and chatting. There is **no sign-up** — identity is just a **nickname**.

## What users see first

The **Home / landing page** (`/`) on a near-black violet-tilted canvas with an ambient "aurora" glow:

- Top-left **logo** (three colored dots — violet, magenta, green — + the wordmark "MMMuzik"), top-right tagline "Listen together, in sync." (hidden on small screens).
- A **hero**: a pill badge ("Real-time listening rooms" with a tiny animated equalizer), a large headline **"Listen to music _together_, in real time."** (the word "together" rendered in a violet→magenta gradient), a supporting paragraph, and two primary CTAs: **Create a room** and **Join a room**.
- A social-proof row: a stack of 4 overlapping avatars + "2,400+ sessions started this week".
- On large screens (≥1024px), a **preview card** to the right of the hero showing a fake now-playing state ("Blinding Lights — The Weeknd", a progress bar, two chat lines) — purely decorative.
- Below the hero, **three feature cards**: "In perfect sync", "A shared queue", "Chat in real time".
- A footer: "No account needed. Just a nickname. · Built with Next.js · MMMuzik".

## Main navigation flow

The app has exactly **three routes** (public, unauthenticated):

```
/                  Home (create or join)
/join/[code]       Join screen (confirm room + enter nickname)
/room/[roomId]     The live room (player + queue + chat + participants)
```

There is **no global nav bar, no sidebar menu, no account/settings pages**. Navigation happens through CTAs and the in-room header (logo → home, leave → home).

## User journey: landing → room playback

```
HOME (/)
│
├─ "Create a room"  → dialog (room name + your nickname) → [Create & enter room]
│        └─────────────────────────────────────────────────────────▶ ROOM (/room/[id]) as HOST
│
└─ "Join a room"    → dialog (room code) → [Continue] (validates code)
         └────────────────────────────────────▶ JOIN (/join/[code])
                                                  ├─ room summary card (name, code, listeners)
                                                  └─ nickname field → [Join Room]
                                                        └──────────────▶ ROOM (/room/[id]) as MEMBER

Inside ROOM:
  add a song (anyone) → it appears in the shared Queue → first track auto-plays
  → everyone's player shows the same track at the same position ("In sync")
  → host controls play/pause/seek via the native player; guests follow
  → chat + participant presence update live
  → Leave (or room closes) → back to HOME
```

Invite links resolve to `/join/[code]`. A closed/invalid room shows an error on the join screen (never a joinable UI). A room that closes while you're inside shows a full-screen "This room has closed" state.

---

# 2. Design System

> All tokens live in `globals.css` as **HSL CSS variables** consumed through Tailwind (`tailwind.config.ts`). **Never hardcode hex** — V2 should replicate the same token pipeline. Dark is the **default and only applied** theme (a light theme exists but `<html>` is locked to dark via the theme provider + `color-scheme: dark`).

## 2.1 Color tokens (dark — the default)

Format is `H S% L%` (consumed as `hsl(var(--token))`). Approximate hex is a convenience only; the HSL values are authoritative.

| Token | HSL value | Approx hex | Usage |
|-------|-----------|-----------|-------|
| `--background` | `240 18% 7%` | ~`#0e0e15` | App canvas — near-black with a violet tilt |
| `--surface` | `240 14% 11%` | ~`#18181f` | Cards / panels (`bg-surface`) |
| `--surface-2` | `240 12% 15%` | ~`#22222c` | Elevated: inputs, popovers, hover, chips |
| `--foreground` | `240 20% 97%` | ~`#f6f6fb` | Primary text |
| `--muted` | `240 12% 15%` | ~`#22222c` | Muted fills |
| `--muted-foreground` | `240 8% 64%` | ~`#9c9caa` | Secondary text, timestamps, labels |
| `--card` | `240 14% 11%` | ~`#18181f` | Card surface |
| `--card-foreground` | `240 20% 97%` | ~`#f6f6fb` | Card text |
| `--popover` | `240 12% 13%` | ~`#1d1d26` | Tooltip / popover surface |
| `--popover-foreground` | `240 20% 97%` | ~`#f6f6fb` | Popover text |
| `--border` | `240 10% 20%` | ~`#2e2e38` | Borders, dividers |
| `--input` | `240 10% 18%` | ~`#29292f` | Input borders |
| `--primary` | `258 90% 66%` | ~`#7c5cf6` | **VIOLET brand accent** — primary buttons, active queue item, play, links, focus ring |
| `--primary-foreground` | `0 0% 100%` | `#ffffff` | Text/icons on primary |
| `--accent` | `326 84% 64%` | ~`#ec5bb0` | **MAGENTA** — secondary highlight, host badge, presence accents |
| `--accent-foreground` | `0 0% 100%` | `#ffffff` | Text on accent |
| `--success` | `142 71% 45%` | ~`#1fc16b` | **GREEN** — "in sync", online presence, copy-success checks |
| `--success-foreground` | `0 0% 100%` | `#ffffff` | Text on success |
| `--destructive` | `0 72% 55%` | ~`#e23b3b` | Remove, leave, errors |
| `--destructive-foreground` | `0 0% 100%` | `#ffffff` | Text on destructive |
| `--ring` | `258 90% 66%` | ~`#7c5cf6` | Focus ring (= primary violet) |

**Light theme** (`.light`, defined but not used by default): same token names, light values (`--background: 240 20% 98%`, `--surface: 0 0% 100%`, `--primary: 258 90% 60%`, etc.). V2 may keep this dormant.

**Tailwind exposes these as color utilities**: `bg-background`, `bg-surface`, `bg-surface-2`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`/`text-primary`, `bg-accent`/`text-accent`, `bg-success`/`text-success`, `bg-destructive`/`text-destructive`, `bg-card`, `bg-popover`, `ring-ring`. Opacity modifiers are used heavily (`bg-primary/10`, `border-border/60`, `text-foreground/80`, etc.).

**Tailwind palette colors** also appear directly for avatar gradients and the idle presence dot: `from-violet-500 to-fuchsia-500`, `from-fuchsia-500 to-pink-500`, `from-sky-500 to-indigo-500`, `from-emerald-500 to-teal-500`, `from-amber-500 to-orange-500`, `from-rose-500 to-red-500`, `from-cyan-500 to-blue-500`, `from-purple-500 to-indigo-500`; and `bg-amber-400` (idle presence).

## 2.2 Backgrounds & surface effects

| Utility | Definition | Used by |
|---------|-----------|---------|
| `.bg-aurora` | Three layered radial gradients: `radial-gradient(60% 60% at 15% 0%, hsl(var(--primary)/0.18), transparent 60%)`, `radial-gradient(50% 50% at 100% 10%, hsl(var(--accent)/0.14), transparent 55%)`, `radial-gradient(40% 40% at 80% 100%, hsl(var(--success)/0.08), transparent 60%)` | Home hero backdrop, join screen, room-closed screen, RoomInfoCard header, PlayerCard background |
| `.text-gradient-brand` | `linear-gradient(92deg, hsl(var(--primary)), hsl(var(--accent)))` clipped to text | The word "together" in the hero headline |
| `.surface-panel` | `rounded-2xl border border-border/70 bg-surface shadow-panel` | Every card/panel (participants, queue, chat, player, feature cards, dialogs use a near-identical recipe) |
| `.scrollbar-thin` | Thin custom scrollbar, thumb `hsl(var(--border))`, 8px wide | Internal scroll areas (queue, chat, participants) |

Aurora glow is also applied as a decorative blurred halo behind the home preview card: `absolute -inset-6 rounded-[2rem] bg-aurora blur-2xl`.

## 2.3 Typography

- **Font family:** **Inter** (loaded via `next/font/google`, `display: swap`, exposed as CSS var `--font-sans`). Tailwind `font-sans` = `var(--font-sans), ui-sans-serif, system-ui, sans-serif`.
- **Font features:** `font-feature-settings: "cv11", "ss01"` + `text-rendering: optimizeLegibility` + `antialiased` on `<body>`.
- **Tabular numbers:** `tabular-nums` used for durations, timestamps, queue indices, clock times.

### Type scale (as used)

| Role | Classes | Notes |
|------|---------|-------|
| Hero headline | `text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.05] tracking-tight` | Home only; `text-balance` |
| Page/section title (join room name) | `text-xl font-semibold` | RoomInfoCard |
| Dialog title | `text-lg font-semibold` | |
| Card heading | `text-base font-semibold` | Feature cards, error titles |
| Panel header title | `text-sm font-semibold tracking-wide` | Queue/Chat/Participants headers |
| Room title (header) | `text-sm sm:text-base font-semibold` | |
| Body | `text-sm` | Chat bubbles, descriptions |
| Body large (hero copy) | `text-base sm:text-lg` | |
| Meta / secondary | `text-xs text-muted-foreground` | timestamps, "added by", counts |
| Micro meta | `text-[10px]` / `text-[9px]` | chat timestamp, small avatar initials |

Weights in use: `font-normal`, `font-medium`, `font-semibold`. No bold/black. Tracking: `tracking-tight` (headings), `tracking-wide` (panel titles), `tracking-widest` / `tracking-[0.3em]` (room codes).

## 2.4 Border radius

Driven by `--radius: 0.85rem`. Tailwind mapping:

| Class | Value |
|-------|-------|
| `rounded-sm` | `calc(0.85rem - 4px)` |
| `rounded-md` | `calc(0.85rem - 2px)` |
| `rounded-lg` | `0.85rem` |
| `rounded-xl` | `calc(0.85rem + 4px)` |
| `rounded-2xl` | `calc(0.85rem + 8px)` |
| `rounded-full` | pills, avatars, presence dots, icon-lg play button, badges |

In practice: **buttons** `rounded-xl` (sm `rounded-lg`, icon-lg `rounded-full`), **inputs** `rounded-xl`, **panels/dialogs** `rounded-2xl`, **queue/participant rows** `rounded-xl`, **chat bubbles** `rounded-2xl` (with one tightened corner `rounded-br-md`/`rounded-bl-md`), **badges** `rounded-full`, **artwork** `rounded-2xl` (large) / `rounded-lg` (thumbnail), **avatars** `rounded-full`.

## 2.5 Shadows

| Class | Definition | Used by |
|-------|-----------|---------|
| `shadow-glow` | `0 0 0 1px hsl(var(--primary)/0.25), 0 12px 40px -12px hsl(var(--primary)/0.45)` | Primary play button, now-playing artwork, gradient art tiles, home preview art |
| `shadow-panel` | `0 1px 0 0 hsl(var(--border)/0.6), 0 12px 32px -16px rgb(0 0 0/0.6)` | All `.surface-panel` cards, dialogs, sheets, toasts |
| `shadow-sm` / `shadow` / `shadow-md` | Tailwind defaults | inputs (`shadow-sm`), tooltip (`shadow-md`), slider thumb |

## 2.6 Spacing system

4px base (Tailwind default scale). Conventions actually used:

- **Panel body padding:** `p-4` (most panels); `p-5`/`p-6` for the player and dialogs; `p-2` for scroll-area row containers.
- **Panel header:** `px-4 py-3`.
- **Room layout gap:** `gap-3` between the three columns; `p-3` outer padding around the room body.
- **Row gaps:** `gap-2`/`gap-3` (icon + text), `gap-4`/`gap-5` (artwork + meta).
- **Vertical rhythm in forms:** `space-y-4` (form), `space-y-2` (label + input).
- **Chat list:** `gap-3` between messages, `p-4` container.
- **Queue/participant lists:** `space-y-0.5` between rows.
- **Header bar:** `px-3 py-2.5 sm:px-4`.

## 2.7 Responsive breakpoints

Two systems are in play:

**(a) Tailwind breakpoints** (mobile-first prefixes): `sm:640px`, `md:768px`, `lg:1024px`, `xl:1280px`, `2xl:1400px` (container max-width capped at `1400px`, centered, `padding: 1.5rem`).

**(b) The room's JS breakpoint hook** (`useBreakpoint`) — picks **exactly one** room layout so feature hooks mount once:

| Breakpoint | Range | Room layout |
|-----------|-------|-------------|
| `mobile` | `< 768px` | Tabbed single column (Player / Queue / Chat / People) with a bottom tab bar |
| `tablet` | `768px – 1023.98px` | Player + Chat side-by-side; People & Queue open in side **Sheets** |
| `desktop` | `≥ 1024px` | Three columns: Participants · Player+Queue · Chat |

SSR default is `desktop`; it corrects on mount via `matchMedia`.

`<meta viewport>`: `width=device-width, initialScale=1, viewportFit=cover`. Theme color `#0d0d14`. Layouts use `min-h-dvh` / `h-dvh` (dynamic viewport height) so mobile chrome doesn't clip the player/chat.

---

# 3. Layout Structure

## 3.1 Root shell (all pages)

```
<html lang="en" class="dark + Inter font var">
└─ <body class="min-h-dvh bg-background font-sans antialiased">
   ├─ ThemeProvider (forces dark; no system theme; no transition on change)
   ├─ {page}
   └─ <Toaster>  (sonner, bottom-center, themed dark)
```

There is **no shared header or footer component** across routes — each screen builds its own.

## 3.2 Home page (`/`)

```
HomePage
├─ aurora overlay (absolute, top 70vh, pointer-events-none)
└─ container (mx-auto max-w-6xl, px-5 sm:px-8, min-h-dvh flex-col)
   ├─ Header (py-6, flex justify-between)
   │   ├─ Logo (size md, dots + wordmark)
   │   └─ tagline "Listen together, in sync." (hidden < sm)
   ├─ Main (flex-1, justify-center, gap-16)
   │   ├─ HomeHero
   │   │   ├─ [left] badge pill · h1 headline · paragraph · CreateRoomCard + JoinRoomCard · avatar stack + sessions count
   │   │   └─ [right, hidden < lg] preview card
   │   └─ FeatureCards (grid: 1 / sm:2 / lg:3)
   └─ Footer (border-t, py-6, centered text-xs)
```

## 3.3 Join page (`/join/[code]`)

```
JoinRoomPanel  (main: min-h-dvh, centered, bg-aurora, px-4 py-10)
├─ Logo (link to /, size md, mb-8)
└─ column (w-full max-w-md, space-y-5)
   ├─ [loading]  surface-panel + Spinner "Looking up the room…"
   ├─ [error]    surface-panel + AlertTriangle + "Room not found" + [Back to Home]
   └─ [success]
       ├─ RoomInfoCard (name, code badge, listener count, optional now-playing teaser)
       ├─ surface-panel → NicknameForm (label, input, [Join Room])
       └─ helper text "No account needed — your nickname is your identity…"
```

## 3.4 Room page (`/room/[roomId]`)

```
RoomExperience
├─ [closed]   full-screen bg-aurora · DoorClosed icon · "This room has closed" · [Back to Home]
├─ [loading]  RoomSkeleton (mirrors the 3-column layout)
└─ [ready]    flex h-dvh flex-col, bg-background
    ├─ RoomHeader (shrink-0, border-b, bg-surface/60 backdrop-blur)
    │   ├─ [left]  Logo(dots only) · divider · room name · ConnectionBanner(≥sm)
    │   └─ [right] InviteShare (code chip + Copy link) · divider · Leave button
    └─ main (flex-1, min-h-0)
        └─ RoomLayout  ← responsive (desktop / tablet / mobile)
```

### Desktop room body (≥1024px)

```
grid-cols-[clamp(220px,18vw,280px)  minmax(0,1fr)  clamp(300px,24vw,360px)]  gap-3  p-3
┌──────────────┬─────────────────────────────────┬──────────────┐
│ Participants │  PlayerCard (now-playing stage)  │     Chat     │
│   (rail)     │  ──────────────────────────────  │   (column)   │
│              │  QueueList (flex-1, fills below)  │              │
└──────────────┴─────────────────────────────────┴──────────────┘
```

### Tablet room body (768–1023px)

```
flex-col gap-3 p-3
┌───────────────────────────────────────────────┐
│ [People ▸ sheet]   [Queue ▸ sheet]             │  ← trigger buttons row
├───────────────────────────────────────────────┤
│  PlayerCard (self-start)        │   Chat (320px)│  ← grid-cols-[minmax(0,1fr) 320px]
└───────────────────────────────────────────────┘
```

### Mobile room body (<768px)

```
Tabs (flex-col h-full)
┌───────────────────────────┐
│   active tab content       │  (Player | Queue | Chat | People), p-3
│                            │
├───────────────────────────┤
│ [♪ Player][≣ Queue][💬 Chat][👥 People] │  ← bottom TabsList, grid-cols-4, m-3
└───────────────────────────┘
```

---

# 4. Screen Inventory

> Screenshot references point at the mockup board `MMMuzik.fe/UI.png` (frames labeled HOME PAGE, JOIN ROOM, ROOM PAGE DESKTOP, ROOM PAGE MOBILE, and a components/color-swatches frame). The board confirms the **violet/magenta** direction.

## 4.1 Landing Page — `/`

- **Layout:** §3.2. Aurora glow top, centered max-w-6xl column, header / hero / features / footer.
- **Hero (left column):**
  - **Badge pill** — `inline-flex rounded-full border bg-surface/60 px-3 py-1 text-xs text-muted-foreground`, containing an animated `SoundBars` equalizer + "Real-time listening rooms".
  - **Headline** — "Listen to music **together**, in real time." with "together" wrapped in `.text-gradient-brand` (violet→magenta). `text-4xl sm:text-5xl lg:text-6xl`, `leading-[1.05]`, `tracking-tight`.
  - **Paragraph** — `max-w-xl text-base sm:text-lg text-muted-foreground`.
  - **CTAs** — `CreateRoomCard` (primary violet button "Create a room" + Plus icon) and `JoinRoomCard` (secondary button "Join a room" + LogIn icon). Stacked on mobile (`flex-col`), inline on `sm`.
  - **Social proof** — overlapping avatar stack (`-space-x-2`, each `h-8 w-8 ring-2 ring-background`, gradient fallback + initials) for Mai/Lena/Gabe/Sora + "**2,400+** sessions started this week".
- **Hero (right column, hidden `< lg`):** decorative preview card (`surface-panel p-6`) with a blurred aurora halo behind it. Shows: gradient album tile (`h-20 w-20 rounded-2xl from-primary to-accent shadow-glow` + Play icon), "Now playing · in sync" (success color, SoundBars), "Blinding Lights" / "The Weeknd", a 36%-filled progress bar (`h-1.5 rounded-full bg-surface-2` track, `bg-primary` fill), `1:12 / 3:20`, and two preview chat rows.
- **Feature cards:** three `surface-panel p-5` cards in a `grid sm:grid-cols-2 lg:grid-cols-3 gap-4`. Each: a `h-11 w-11 rounded-xl` gradient-tinted icon tile, a `text-base font-semibold` title, a `text-sm text-muted-foreground` body. Hover: `hover:border-border`. Content:
  - Radio · "In perfect sync" · primary tint (`from-primary/20 text-primary`)
  - ListMusic · "A shared queue" · accent tint (`from-accent/20 text-accent`)
  - MessagesSquare · "Chat in real time" · success tint (`from-success/20 text-success`)
- **Footer:** `border-t border-border/50 py-6 text-center text-xs text-muted-foreground` — "No account needed. Just a nickname. · Built with Next.js · MMMuzik".
- **Interactions:** Both CTAs open **modal dialogs** (see [Create Room dialog](#52-create-room-dialog) / [Join Room dialog](#53-join-room-dialog)). No inline forms on the page itself.

## 4.2 Create Room (dialog, launched from Home)

- **Trigger:** `Button size="lg"` "Create a room" (Plus icon).
- **Dialog:** centered modal (`max-w-lg rounded-2xl border bg-surface p-6 shadow-panel`), overlay `bg-black/70 backdrop-blur-sm`, close "X" top-right.
- **Title:** Radio icon (violet) + "Create a room". **Description:** "Start a session and invite friends with a link. You'll be the host."
- **Fields:** "Room name" (autofocus, placeholder `Friday Vibes`, maxLength 40) and "Your nickname" (placeholder `DJ Duy`, maxLength 24).
- **Error:** inline `text-xs text-destructive` above the footer.
- **Submit:** full-width button "Create & enter room" → "Creating…" while pending (disabled). On success, navigates to `/room/[roomId]` as host.

## 4.3 Join Room (dialog, launched from Home)

- **Trigger:** `Button size="lg" variant="secondary"` "Join a room" (LogIn icon).
- **Dialog:** same modal chrome. Title LogIn icon (violet) + "Join a room". Description "Enter the room code a friend shared with you."
- **Field:** "Room code" input — **center-aligned, `text-lg tracking-[0.3em]`**, placeholder `7QK-2MD`, maxLength 7, **auto-formatted to `ABC-123`** as you type (uppercased, hyphen inserted after 3 chars). `aria-invalid` when errored.
- **Submit:** "Continue" → "Checking…" while validating; **disabled until ≥4 alphanumeric chars**. Valid code → navigates to `/join/[code]`. Invalid → inline error; closing the dialog clears the error.

## 4.4 Join Room Page — `/join/[code]`

- **Layout:** §3.3. Centered `max-w-md` column on a full-screen aurora background, logo on top (links home).
- **Loading state:** `surface-panel` with a `Spinner` + "Looking up the room…".
- **Error / closed-room state:** `surface-panel` card — destructive AlertTriangle tile (`h-12 w-12 rounded-2xl bg-destructive/15`), "**Room not found**" heading, the error message, and a secondary **[Back to Home]** button.
- **Success state:**
  - **RoomInfoCard** (see [§5.5](#55-roominfocard)) — "You're joining", room name, code badge + "N listening", optional "Now playing …" teaser.
  - **NicknameForm** in a `surface-panel p-5` — single autofocus field "Your nickname" (placeholder "Pick a name to join as", maxLength 24), **Enter submits**, primary `size="lg"` button "Join Room" + ArrowRight (→ "Joining…" while submitting, disabled until non-empty). Duplicate nicknames are silently suffixed server-side (e.g. "Mai (2)").
  - Helper line: "No account needed — your nickname is your identity in the room."

## 4.5 Room Page — `/room/[roomId]`

The live experience. Three sub-states:

- **Loading (`RoomSkeleton`):** full-screen skeleton mirroring the desktop 3-column layout — skeleton header, a participants column (5 avatar+line rows), a player card (artwork block + title lines + a 3-button control row placeholder), a queue list (4 rows), and a chat column (6 alternating bubbles). Uses `animate-pulse` `bg-surface-2` blocks so there's never a blank screen.
- **Closed (`This room has closed`):** centered on aurora — DoorClosed icon tile, "This room has closed", "The session ended or the host left. Start a new one anytime.", primary **[Back to Home]**.
- **Ready:** RoomHeader + responsive RoomLayout (see [§8](#8-room-experience), [§3.4](#34-room-page-roomroomid)).

## 4.6 Playback View

Not a separate route — it is the **PlayerCard** region inside the room (center column on desktop, "Player" tab on mobile). Fully covered in [§6](#6-playback-ui).

## 4.7 Queue View

Not a separate route — the **QueueList** panel (below the player on desktop, "Queue" tab on mobile, a right Sheet on tablet). Covered in [§7](#7-queue-ui).

## 4.8 Mobile View

The room renders a **tabbed single-column** layout below 768px with a bottom tab bar. Covered in [§10](#10-mobile-experience).

## 4.9 Tablet View

768–1023px: Player + Chat side-by-side (chat fixed 320px), with **Participants** and **Queue** opening as side **Sheets** from trigger buttons. Covered in [§10](#10-mobile-experience).

---

# 5. Component Catalog

> Conventions: built on **shadcn/ui + Radix** primitives styled with the tokens above. Icons are **lucide-react**. `cn()` merges Tailwind classes.

## 5.0 Primitive components (shadcn/ui)

### Button (`button.tsx`)
Base: `inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-colors` + focus ring + `disabled:opacity-50` + auto-sizes any SVG to `size-4`.

| Variant | Style |
|---------|-------|
| `default` | `bg-primary text-primary-foreground shadow-glow hover:bg-primary/90 active:scale-[0.98]` |
| `secondary` | `bg-surface-2 text-foreground border border-border hover:bg-surface-2/80` |
| `outline` | `border border-border bg-transparent hover:bg-surface-2` |
| `ghost` | `text-foreground hover:bg-surface-2` |
| `destructive` | `bg-destructive text-destructive-foreground hover:bg-destructive/90` |
| `success` | `bg-success text-success-foreground hover:bg-success/90` |
| `link` | `text-primary underline-offset-4 hover:underline` |

| Size | Style |
|------|-------|
| `default` | `h-10 px-4 py-2` |
| `sm` | `h-9 rounded-lg px-3` |
| `lg` | `h-12 rounded-xl px-6 text-base` |
| `icon` | `h-10 w-10` |
| `icon-sm` | `h-8 w-8 rounded-lg` |
| `icon-lg` | `h-14 w-14 rounded-full` |

### Badge (`badge.tsx`)
`inline-flex gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold`. Variants: `default` (`bg-primary/15 text-primary`), `accent` (`bg-accent/15 text-accent`), `success` (`bg-success/15 text-success`), `secondary` (`border-border bg-surface-2 text-muted-foreground`), `outline`, `destructive` (`bg-destructive/15 text-destructive`).

### Input (`input.tsx`)
`h-11 w-full rounded-xl border border-input bg-surface-2 px-3.5 py-2 text-sm shadow-sm` + `placeholder:text-muted-foreground/70` + focus ring + `disabled:opacity-50`.

### Dialog (`dialog.tsx`, Radix)
Overlay `fixed inset-0 bg-black/70 backdrop-blur-sm` (fade in/out). Content `fixed left-1/2 top-1/2 -translate-x/y-1/2 w-full max-w-lg rounded-2xl border bg-surface p-6 shadow-panel` with **fade + zoom-95** enter/exit (`duration-200`). Always has a top-right Close "X" (`absolute right-4 top-4`, ghost hover). Header `flex-col gap-1.5`; Footer `flex-col-reverse gap-2 sm:flex-row sm:justify-end`; Title `text-lg font-semibold`; Description `text-sm text-muted-foreground`.

### Sheet (`sheet.tsx`, Radix — used on tablet)
Same overlay. Panel slides from a side: `left`/`right` are `w-3/4 sm:max-w-sm` with a border on the inner edge; `top`/`bottom` full-width. Enter 300ms / exit 200ms slide. Top-right Close "X". Header `p-4`; Title `text-base font-semibold`.

### Tabs (`tabs.tsx`, Radix — mobile room nav)
`TabsList`: `inline-flex gap-1 rounded-xl bg-surface p-1 text-muted-foreground`. `TabsTrigger`: `flex-1 rounded-lg px-3 py-2 text-sm font-medium`, **active** = `bg-primary text-primary-foreground shadow`. (In the room, the list is overridden to `grid grid-cols-4 rounded-2xl` and triggers stack icon over label `flex-col gap-1 py-2 text-xs`.)

### Avatar (`avatar.tsx`, Radix)
`relative h-10 w-10 rounded-full overflow-hidden`. Image `object-cover`. Fallback `flex items-center justify-center rounded-full bg-surface-2 text-xs font-semibold` — but callers pass a **deterministic gradient** (`bg-gradient-to-br` + `avatarGradient(seed)`) and white initials. Sizes overridden per use: `h-6/h-7/h-8/h-9 w-…`.

### Slider (`slider.tsx`, Radix)
Track `h-1.5 rounded-full bg-surface-2`; Range `bg-primary`; Thumb `h-3.5 w-3.5 rounded-full border-2 border-primary bg-foreground shadow`, **hidden until hover/focus** (`opacity-0 group-hover:opacity-100 focus-visible:opacity-100`). Used by the (unmounted) PlaybackControls/PlaybackProgress.

### ScrollArea (`scroll-area.tsx`, Radix)
Viewport fills height; custom scrollbar `w-2.5` with `bg-border` rounded thumb. Wraps the queue, chat, and participant lists. Paired with the `.scrollbar-thin` utility.

### Tooltip (`tooltip.tsx`, Radix)
Content `rounded-lg border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md` with fade+zoom animation. Default `delayDuration={150}` where used. Used for: Leave room, Copy invite link, and the host-only playback guard.

### Toaster (`sonner.tsx`)
`position="bottom-center"`. Toasts themed: `bg-surface text-foreground border-border shadow-panel rounded-xl`; description `text-muted-foreground`; action button `bg-primary text-primary-foreground`; cancel `bg-surface-2`.

### Skeleton (`skeleton.tsx`)
`animate-pulse rounded-lg bg-surface-2`.

### Label / Separator
Label: `text-sm font-medium text-foreground`. Separator: `bg-border`, `h-px w-full` (horizontal) or `h-full w-px` (vertical).

## 5.1 Logo (`Logo.tsx`)
The **triple-M motif**: three stacked rounded dots in **violet (`bg-primary`) · magenta (`bg-accent`) · green (`bg-success`)**, optionally followed by the wordmark "MMMuzik" (`font-semibold tracking-tight`). Sizes `sm` (dots `h-2 w-2`, `text-base`), `md` (`h-2.5`, `text-lg`), `lg` (`h-3`, `text-2xl`). Optionally wraps in a link to `/` with `aria-label="MMMuzik home"`. Room header uses `size="sm" showWordmark={false}` (dots only).

## 5.2 Create Room dialog (`CreateRoomCard.tsx`)
See [§4.2](#42-create-room-dialog).

## 5.3 Join Room dialog (`JoinRoomCard.tsx`)
See [§4.3](#43-join-room-dialog).

## 5.4 NicknameForm (`NicknameForm.tsx`)
Single field + lg submit; Enter submits; `aria-invalid` + `aria-describedby` wired to the error; disabled until trimmed non-empty. See [§4.4](#44-join-room-page--joincode).

## 5.5 RoomInfoCard (`RoomInfoCard.tsx`)
`surface-panel overflow-hidden`. Top section on `bg-aurora p-5`: a `h-14 w-14 rounded-2xl from-primary to-accent text-white shadow-glow` Headphones tile; "You're joining" (uppercase `text-xs tracking-wide muted`); room **name** (`text-xl font-semibold`, truncates); a **code Badge** (`variant="secondary" tracking-widest`) + Users icon + "N listening". If a track is playing, a bottom row (`border-t`): Music2 (violet) + "Now playing **{title}**".

## 5.6 RoomHeader (`RoomHeader.tsx`)
`flex items-center justify-between border-b border-border/60 bg-surface/60 px-3 py-2.5 backdrop-blur sm:px-4`.
- **Left:** Logo (dots only) · vertical divider (`h-6 w-px bg-border`, hidden `< sm`) · room **name** (`truncate text-sm sm:text-base font-semibold`) · `ConnectionBanner` (hidden `< sm`).
- **Right:** `InviteShare` · divider · **Leave** button (`ghost size="icon"`, LogOut icon, `aria-label="Leave room"`, `hover:text-destructive`, tooltip "Leave room").

## 5.7 InviteShare (`InviteShare.tsx`)
Two share affordances:
- **Code chip** — a `button` styled `rounded-lg border bg-surface-2 px-2.5 py-1.5 text-xs`, showing the **room code** in `tracking-widest text-foreground` plus a Copy icon (`opacity-60 group-hover:opacity-100`). Click → copies code → icon swaps to a **green Check** for 1.5s → toast "**Room code copied**".
- **Copy link** — `secondary size="sm"` button, Link2 icon + label "Copy link" (label hidden `< sm`). Click → copies invite URL → green Check 1.5s → toast "**Invite link copied**". Copy failure → toast "Couldn't copy — copy it manually".
- **Compact variant** (prop, not used in the default header) — a single `secondary size="icon"` Share2 button with tooltip "Copy invite link".

## 5.8 ConnectionBanner (`ConnectionBanner.tsx`)
A status pill, `role="status" aria-live="polite"`. **Hidden** while `connected`/`idle`. While `reconnecting`/`connecting`: `border-accent/40 bg-accent/10 text-accent` with a `Wifi` icon `animate-pulse-ring` + "Reconnecting…". While `disconnected`: `border-destructive/40 bg-destructive/10 text-destructive` with `WifiOff` + "Disconnected". Shown inline in the header (≥sm).

## 5.9 Panel (`Panel.tsx`)
The shared surface container for Participants/Queue/Chat. `flex min-h-0 flex-col overflow-hidden surface-panel`. Optional header (`border-b px-4 py-3`) with: leading icon (`text-muted-foreground`), title (`text-sm font-semibold tracking-wide`), meta count (`text-xs muted`), and a right-aligned `action` slot (e.g. the "Add song" button). Body is `p-4` unless `flush` (lists use flush + their own padding).

## 5.10 PlayerCard / NowPlaying / YouTubePlayer
See [§6](#6-playback-ui).

## 5.11 QueueList / QueueItem / AddSongDialog
See [§7](#7-queue-ui).

## 5.12 ChatPanel / MessageList / ChatMessage / MessageInput
- **ChatPanel** — `Panel` titled "Chat" (MessageCircle icon), `flush`, containing the list + composer.
- **MessageList** — `ScrollArea` (`scrollbar-thin`), `aria-live="polite" aria-relevant="additions"`, `flex-col gap-3 p-4`, **auto-scrolls to the newest message**. Empty state: MessageSquare icon + "No messages yet" / "Say hi 👋 and react to what's playing."
- **ChatMessage** — two shapes:
  - **System** (joins/leaves/host transfer): a centered chip `rounded-full bg-surface-2 px-3 py-1 text-xs text-muted-foreground`.
  - **User**: avatar (`h-7 w-7`, gradient fallback) + a column (`max-w-[78%]`) with name (others only) + clock time (`text-[10px] tabular-nums`) + bubble (`rounded-2xl px-3 py-2 text-sm`). **Self** messages: right-aligned (`flex-row-reverse`, `items-end`), bubble `bg-primary text-primary-foreground rounded-br-md`. **Others**: left, bubble `bg-surface-2 text-foreground rounded-bl-md`. A `failed` status appends "⚠ Failed to send · tap to retry" (`text-[10px] text-destructive`).
- **MessageInput** — `border-t p-3`, Input (`h-10`, placeholder "Message the room…", `aria-label="Message"`) + primary `size="icon"` Send button (SendHorizonal, `aria-label="Send message"`), disabled while empty. **Enter submits**, empty trimmed input ignored, field clears on send.

## 5.13 ParticipantList / ParticipantCard / HostBadge
- **ParticipantList** — `Panel` titled "Participants" (Users icon), meta "**N online**", `flush`, scrolling list. When alone (≤1 participant), a bottom `border-t` EmptyState: "You're the only one here" / "Share the room link to listen together."
- **ParticipantCard** — row `rounded-xl px-2 py-2 hover:bg-surface-2`: avatar `h-9 w-9` (gradient fallback + initials) with a **presence dot** bottom-right (`h-3 w-3 rounded-full border-2 border-surface`, `title` = status); nickname (`text-sm font-medium`, truncates) + "(you)" suffix for self; **HostBadge** if host. Presence colors: `online` → `bg-success`, `idle` → `bg-amber-400`, `offline` → `bg-muted-foreground/50`.
- **HostBadge** — `Badge variant="accent"` (magenta tint) with a Crown icon + "Host" (text + icon so color isn't the only signal).

## 5.14 Feedback / state components
- **EmptyState** (`EmptyState.tsx`) — centered `flex-col items-center gap-3 px-6 py-10 text-center`; optional icon in a `h-12 w-12 rounded-2xl bg-surface-2 text-muted-foreground` tile; title (`text-sm font-medium`), description (`text-xs muted max-w-[34ch]`), optional action. Used by queue, chat, player, participants.
- **Spinner** (`Spinner.tsx`) — `Loader2` `animate-spin text-muted-foreground` (`h-5 w-5`), `role="status"`, sr-only "Loading…".
- **SoundBars** (`SoundBars.tsx`) — three `w-0.5 rounded-full bg-primary` bars; when `playing` they run `animate-equalizer` (staggered `0.18s` delays, height `0.75rem`); when paused they collapse to `h-1`. The "now playing / in sync" motif (in the now-playing badge, queue current row, hero pill).
- **Toasts** — only **three** are actually emitted in V1: "Room code copied", "Invite link copied" (+ copy-fail), and "Added to the queue". (The older spec's join/leave/host-change toasts are **not** implemented as toasts; presence shows in the participant list and host changes flip controls silently / appear as system chat chips.)
- **Loading states inventory:** join lookup spinner; room skeleton; button pending labels ("Creating…", "Checking…", "Joining…", "Adding…"); YouTube **loading poster** (thumbnail) until the player paints.
- **Empty states inventory:** Queue "Queue's empty"; Chat "No messages yet"; Player "Nothing playing"; Participants alone "You're the only one here".

## 5.15 Components present but NOT mounted in V1
- **PlaybackControls** (`PlaybackControls.tsx`) — a full transport row (Shuffle · Prev · Play/Pause `icon-lg` with `shadow-glow` · Next · Repeat · Volume slider). Non-host controls are **disabled and wrapped in a tooltip** "Only the host can control playback". **Not rendered** in the current room — kept for reference/V2.
- **PlaybackProgress** (`PlaybackProgress.tsx`) — an accessible seek `Slider` with `m:ss / m:ss` labels and drag-to-seek. **Not rendered** in the current room.

> V2 decision point: V1 ships native YouTube controls (see §6). If V2 wants a custom transport/seek bar instead, these two components define the intended look (violet play button with glow, host-gating via disabled+tooltip, slider with hidden-until-hover thumb).

---

# 6. Playback UI

> The center stage. Component: `PlayerCard` → embeds `YouTubePlayer` (the video hero) + `NowPlaying` (metadata). **Spotify is a typed provider but only YouTube has a player implementation in V1** — a Spotify track would render metadata only (no embed).

## 6.1 Player size & aspect ratio

- The video frame is **16:9** via `aspect-video`, **full width** (`w-full`), capped at **`max-h-[60vh]`** so the queue stays visible beneath it. Background `bg-black` while loading.
- The frame fills the card **edge-to-edge** (no card padding around the video); metadata below gets `px-5 pb-5 sm:px-6 sm:pb-6` (full) / `px-4 pb-4` (compact).
- When there is **no YouTube video** (empty or Spotify), the card uses normal padding (`p-5 sm:p-6` full / `p-4` compact).
- Card chrome: `surface-panel bg-aurora` (the aurora glow sits behind the stage).

## 6.2 Controls placement & host-gating (V1 = native YouTube controls)

- **There is no custom transport overlay.** The listener uses **YouTube's own iframe controls**.
- **Host:** the player is created with native **controls enabled** (`controls: 1`, keyboard enabled). The host plays/pauses/seeks directly on the video; those native interactions become the room's authoritative commands that everyone else follows.
- **Guests:** the player is created **read-only** (`controls: 0`, `disablekb: 1`) — guests cannot scrub/pause; they follow the host. The player is **keyed by role**, so a host↔guest transfer remounts the player with the correct control mode.
- Player vars: `autoplay: 1`, `mute: 1`, `modestbranding: 1`, `rel: 0`, `playsinline: 1`.

## 6.3 Now-playing display (`NowPlaying`)

Rendered **below** the video (the video itself is the artwork, so the thumbnail is hidden when a YouTube video is present, `showArtwork={false}`). Structure:
- A meta row: a **provider Badge** (`secondary`) reading "YouTube"/"Spotify", then a green **"In sync"** indicator (`text-xs font-medium text-success`) with `SoundBars` (animating only while playing).
- **Title** — `truncate font-semibold tracking-tight`, `text-base sm:text-lg` (full) / `text-sm` (compact), with a `title=` tooltip.
- **Artist** — `truncate text-xs text-muted-foreground`.

When `showArtwork` is true (Spotify / no-video case): a `rounded-2xl shadow-glow` artwork tile (`h-24 w-24 sm:h-40 sm:w-40` large / `h-16 w-16` medium) shows the cover image, or a `from-primary/40 to-accent/40` gradient with a Music2 icon when there's no art.

## 6.4 Sync indicators

- The **"In sync"** label + animated SoundBars (green) is the user-facing sync signal — present whenever a track is loaded; bars animate while playing, freeze when paused.
- The queue's **current row** also shows SoundBars (violet) in place of its index number (see §7).
- Correction is **silent** — the player seeks to the server position without any "jumping" message (per the UX rule "sync transparency").

## 6.5 Current track display & "Nothing playing"

- With a track: the video hero + NowPlaying meta as above.
- **Empty (`Nothing playing`):** `EmptyState` with a Music2 icon — "**Nothing playing**" / "Add a song to the queue to start the session." (`py-8`). The card uses padded layout (no video frame).

## 6.6 Loading & buffering behavior

- **Loading poster:** until the YouTube player paints, a poster image fills the frame (`absolute inset-0 object-cover`) using `artworkUrl` or the YouTube `hqdefault.jpg` thumbnail — avoids a black flash. No second iframe.
- **Buffering:** the player does not show a custom buffering spinner; YouTube's native buffering UI is used. The app deliberately avoids re-seeking mid-buffer (so the user doesn't see thrashing).
- **Muted-autoplay + unmute:** the player **starts muted** (so autoplay is always allowed without a click). While muted and ready, a corner button appears: **"Tap to unmute"** — `absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1.5 text-xs text-white backdrop-blur` with a Volume2 icon. Sound is also restored on the **first pointer/keyboard gesture anywhere** in the app.
- **Escape hatch row** (below the video, `text-xs text-muted-foreground`): "Can't play here?" + **"Open on YouTube"** (ExternalLink, opens `youtube.com/watch?v=…` in a new tab) + a "·" separator + **"Retry"** (RotateCw, reloads the current video in place). This handles YouTube's occasional in-iframe "confirm you're not a bot" wall.
- **Unplayable video:** if a video is removed/private/embedding-disabled, the host's player auto-advances the queue rather than freezing.

## 6.7 Mobile player

The player lives in the **"Player" tab** on mobile (variant still `full`). The 16:9 / `max-h-[60vh]` frame and native controls behave identically. The "compact" variant (a sticky mini-player) exists in the component API but the current room mounts the full player in the tab.

---

# 7. Queue UI

Component: `QueueList` (a `Panel`) → `QueueItem` rows + `AddSongDialog` action.

## 7.1 Queue layout

- **Panel** titled "**Queue**" (ListMusic icon), meta "**N up next**" (only when non-empty), with the **"Add song"** button as the header action. `flush` body.
- **Empty state:** ListMusic icon + "**Queue's empty**" / "Add the first song to get the room going." (`py-8`).
- **Populated:** a `ScrollArea` (`scrollbar-thin`) with rows in `space-y-0.5 p-2`. On desktop the queue sits **below** the player and `flex-1` fills remaining height.

## 7.2 Queue item appearance (`QueueItem`)

Row: `flex items-center gap-3 rounded-xl px-2 py-2`, enters with `animate-slide-in`. Left → right:
1. **Index / now-playing indicator** — a `w-5` cell showing the 1-based position number (`text-xs tabular-nums muted`), OR, for the current track, the violet `SoundBars` equalizer.
2. **Thumbnail** — `h-10 w-10 rounded-lg bg-surface-2` cover image, or a Music2 placeholder.
3. **Title + subline** — title (`truncate text-sm font-medium`); subline (`truncate text-xs muted`) reads "**{artist} · added by {name}**", or just "**Now playing**" for the current track.
4. **Duration** — `text-xs tabular-nums muted`, formatted `m:ss` (or `h:mm:ss`).
5. **Remove button** (host only) — ghost `icon-sm` "X", `aria-label="Remove {title} from queue"`, `text-muted-foreground hover:text-destructive`. **Hidden until row hover/focus** (`opacity-0 group-hover:opacity-100 focus-visible:opacity-100`).

## 7.3 Active (now-playing) track style

The current track stays **in** the queue (it is not removed) and is **highlighted**: `bg-primary/10 ring-1 ring-inset ring-primary/30`, title in `text-primary`, index replaced by violet SoundBars, subline "Now playing". The host **cannot remove** the current track (only skip).

## 7.4 Hover states

- Non-current rows: `hover:bg-surface-2`.
- Remove "X" reveals on hover/focus.
- Current row keeps its violet highlight (no hover change).

## 7.5 Drag / drop

**None in V1.** There is no drag handle and no reorder interaction in the queue UI. (A reorder capability exists on the backend but the frontend does not expose it.) New songs always append to the **tail**; items animate in with `animate-slide-in`.

## 7.6 Add-song flow (`AddSongDialog`)

- **Trigger:** `Button size="sm"` "Add song" (Plus icon) in the panel header. **Anyone** in the room can add.
- **Dialog:** ListPlus icon (violet) + "Add a song"; description "Paste a YouTube or Spotify link. It'll be added to the end of the queue for everyone."
- **Field:** "Song link" Input with a leading **Youtube icon** (`pl-9`), placeholder `https://youtube.com/watch?v=…  or  open.spotify.com/track/…`, autofocus, `aria-invalid`/`aria-describedby` on error.
- **Footer:** ghost "Cancel" + primary "Add to queue" (→ "Adding…", disabled while adding or empty).
- **On success:** toast "**Added to the queue**", field + dialog clear/close. **On error:** inline `text-xs text-destructive` (e.g. invalid link); dialog stays open.

## 7.7 Mobile queue

Lives in the **"Queue" tab** (full height). On tablet it opens as a **right-side Sheet** (`w-96`) titled "Queue". Same rows and add flow.

---

# 8. Room Experience

## 8.1 Host vs guest

| Aspect | Host | Guest |
|--------|------|-------|
| Player controls | Native YouTube controls **enabled**; play/pause/seek drive the room | Read-only player (`controls:0`), follows the host |
| Queue add | Yes | Yes (anyone can add) |
| Queue remove "X" | Visible on hover | **Not shown** |
| Skip current | Yes (via player end / native) | No |
| Host badge | Shown on their participant row | Sees host's badge |
| Transfer | Auto on host leave/disconnect-timeout | A guest may be promoted → their player remounts into host mode and gains controls |

The role switch is **live**: when host transfers, the promoted client's player remounts with native controls and the old host loses them — no reload.

## 8.2 Participant list behavior

Live list with avatar, **presence dot** (green online / amber idle / grey offline), nickname, "(you)" for self, and a Crown **Host** badge. Header meta shows "**N online**". Joins/leaves and host changes update in real time. When you're the only one present, a "Share the room link" empty hint appears at the bottom of the rail.

## 8.3 Room code display

- Always visible in the **header** as a selectable **code chip** (`tracking-widest`), one-click to copy (green check + toast).
- Also shown on the **join screen** as a `secondary` Badge in RoomInfoCard.
- A separate **"Copy link"** button copies the full invite URL.

## 8.4 Connection indicators

The `ConnectionBanner` pill in the header: hidden when connected; **"Reconnecting…"** (magenta/accent, pulsing Wifi) during transient drops; **"Disconnected"** (red, WifiOff) when down. It's `aria-live="polite"` and non-blocking — the UI stays usable.

## 8.5 Realtime updates visible to users

- **Now playing** changes (track, play/pause, position) reflect on every client; the player seeks silently to stay in sync; "In sync" + SoundBars animate.
- **Queue** items appear/disappear live (new items slide in at the tail; removed items vanish; the current track is highlighted).
- **Chat** messages stream in and auto-scroll; system events (joins/leaves/host transfer) appear as centered chips.
- **Presence** dots and the online count update as people come and go.
- **Host transfer** flips controls live and (typically) surfaces as a system chat chip.
- **Room closed** (host left / idle timeout) → the whole room swaps to the full-screen "This room has closed" state.

---

# 9. Animations

Defined in `tailwind.config.ts` (keyframes + `animation`) and Radix/`tailwindcss-animate` data-state utilities.

| Animation | Definition | Where |
|-----------|-----------|-------|
| `fade-in` | opacity 0→1 + `translateY(4px→0)`, **0.2s ease-out** | general entrances |
| `slide-in` | opacity 0→1 + `translateY(8px→0)`, **0.18s ease-out** | **queue items** entering |
| `pulse-ring` | opacity 1→0.4→1, **2s ease-in-out infinite** | reconnecting Wifi icon |
| `equalizer` | `scaleY(0.4→1→0.4)`, **0.9s ease-in-out infinite** | **SoundBars** (each bar offset by `0.18s`) |
| `accordion-down/up` | height 0↔content, **0.2s ease-out** | Radix collapsibles (available) |

**Component-level motion:**
- **Buttons:** `transition-colors`; default variant `active:scale-[0.98]` press feedback.
- **Hover transitions:** queue/participant rows (`transition-colors hover:bg-surface-2`), feature cards (`hover:border-border`), copy icons (`opacity` transitions), remove "X" reveal (`opacity` + `transition`).
- **Dialog:** overlay `fade-in/out`; content `fade + zoom-95` in/out, `duration-200`.
- **Sheet:** slide from side; **enter 300ms / exit 200ms**, `ease-in-out`.
- **Tooltip:** `fade-in-0 zoom-in-95` in / out.
- **Toasts (sonner):** default slide/fade from bottom-center.
- **Artwork / play button:** static `shadow-glow` (no animation), violet halo.
- **Skeletons:** `animate-pulse`.

**Reduced motion:** a global `@media (prefers-reduced-motion: reduce)` rule forces animation/transition durations to ~0 and iteration count to 1 — all the above effectively stop.

Timing philosophy: subtle and fast (≈150–200ms ease-out) for entrances/transitions; only the ambient indicators (equalizer, pulse-ring) loop.

---

# 10. Mobile Experience

> Driven by `useBreakpoint`: `<768px` = mobile (tabs), `768–1023px` = tablet (sheets), `≥1024px` = desktop (3 columns).

## 10.1 Mobile layout (<768px)

- **Single column** with a **bottom tab bar**. The body shows one tab at a time (`p-3 pb-0`, `overflow-hidden`).
- **Tabs:** **Player** (Music2), **Queue** (ListMusic), **Chat** (MessageCircle), **People** (Users). Default tab = **Player**.
- **Tab bar:** `TabsList` overridden to `m-3 grid grid-cols-4 gap-1 rounded-2xl`; each trigger stacks **icon over label** (`flex-col gap-1 py-2 text-xs`); active trigger = `bg-primary text-primary-foreground shadow`.
- **Header:** same RoomHeader, condensed (`px-3 py-2.5`); ConnectionBanner and the divider hide below `sm`; "Copy link" label hides (icon only); room name truncates.
- **Player:** full 16:9 frame, `max-h-[60vh]`, native controls, "Tap to unmute" corner button.
- **Layout heights:** `h-dvh` + `min-h-0` flex chains so the tab content scrolls internally and the tab bar/header stay put above the mobile browser chrome (`viewportFit=cover`).

## 10.2 Tablet layout (768–1023px)

- A top **trigger row**: **"People"** (Users) opens a **left Sheet** (`w-80`, titled "Participants"); **"Queue"** (ListMusic) opens a **right Sheet** (`w-96`, titled "Queue"). Both sheets render the same panels with borders/shadow stripped.
- Below: a 2-column grid `minmax(0,1fr) 320px` — **PlayerCard** (left, `self-start`) + **ChatPanel** (right, fixed 320px, full height).

## 10.3 Collapsed panels

On tablet, Participants and Queue are **collapsed into Sheets** (slide-in overlays from the sides) rather than always-visible columns. On mobile, every panel is a **tab**. Chat is always directly visible on tablet/desktop; on mobile it's the "Chat" tab.

## 10.4 Touch interactions

- Tap targets follow comfortable sizing (buttons `h-9`–`h-12`, icon buttons `h-8`–`h-14`).
- Sheets dismiss via overlay tap or the top-right "X".
- The unmute affordance is a large tappable pill.
- Native YouTube controls provide touch scrubbing for the host; guests follow.
- Sliders (where used) are `touch-none select-none` to avoid scroll conflicts.

---

# 11. Accessibility

- **Focus rings everywhere:** a global `:focus-visible { ring-2 ring-ring ring-offset-2 ring-offset-background }` (violet ring) plus per-component focus styles on buttons, inputs, tabs, sliders, tooltips, the code chip, and links.
- **Icon-only buttons carry `aria-label`s:** Leave room, Send message, Remove "{title}" from queue, Share room / Copy room code "{code}", Shuffle, Repeat, Play/Pause (label toggles), Previous/Next track, Seek, Volume, Logo "MMMuzik home", dialog/sheet "Close".
- **Live regions:** chat `MessageList` is `aria-live="polite" aria-relevant="additions"`; `ConnectionBanner` and `Spinner` are `role="status" aria-live="polite"`; toasts are announced by sonner.
- **Color is never the only signal:** Host badge pairs a Crown **icon + the word "Host"**; presence dots carry a `title` and an `sr-only` label ("Online/Idle/Offline"); the "In sync" state has both green color **and** text + animated bars.
- **Form semantics:** inputs use `aria-invalid` on error and `aria-describedby` pointing at the inline error text; labels are associated via `htmlFor`/`id`.
- **Keyboard:** all interactive elements are reachable; **Enter submits** all forms (create, join, nickname, add-song, chat); Radix Dialog/Sheet/Tabs/Tooltip provide focus trapping, ESC-to-close, and arrow-key tab navigation; the host's player keeps keyboard enabled (`disablekb:0`), guests' is disabled.
- **Decorative elements** are hidden from AT: aurora overlay, logo dots, SoundBars, dividers (`aria-hidden`); decorative images use empty `alt=""`.
- **Reduced motion:** honored globally (see §9).
- **Contrast:** light foreground (`97% L`) on dark surfaces (`7–15% L`); muted text at `64% L` for secondary content; targets WCAG AA on the dark palette.
- **Color scheme:** `<html>` declares `color-scheme: dark` so native form controls/scrollbars render dark.

---

# 12. Screenshots Mapping

> Reference board: `MMMuzik.fe/UI.png` (frames: HOME PAGE · JOIN ROOM · ROOM PAGE DESKTOP · ROOM PAGE MOBILE · components/colors). Use this table to map each screen to the components V2 must build.

| Screen / Region | Components used | Purpose |
|-----------------|-----------------|---------|
| **Home — header** | `Logo`, tagline text | Brand + one-line value prop |
| **Home — hero** | `HomeHero`, `SoundBars`, badge pill, `.text-gradient-brand` headline, `CreateRoomCard`, `JoinRoomCard`, `Avatar` stack | Convert visitor → create/join a room |
| **Home — preview** | decorative card (`.surface-panel`, gradient art, progress bar, mini chat rows) | Show the product's feel at a glance (desktop only) |
| **Home — features** | `FeatureCards` (Radio / ListMusic / MessagesSquare) | Explain sync, shared queue, chat |
| **Home — footer** | static text | "No account needed" reassurance |
| **Create Room dialog** | `Dialog`, `Input`, `Label`, `Button` | Name a room + nickname → become host |
| **Join Room dialog** | `Dialog`, `Input` (code, auto-format), `Button` | Validate a code → go to join screen |
| **Join page** | `JoinRoomPanel`, `Logo`, `RoomInfoCard`, `Badge`, `NicknameForm`, `Spinner`, error card (`AlertTriangle`) | Confirm room + capture nickname |
| **Room — header** | `RoomHeader`, `Logo`, `ConnectionBanner`, `InviteShare`, `Tooltip`, Leave `Button` | Identity, share, connection status, exit |
| **Room — participants** | `ParticipantList`, `ParticipantCard`, `Avatar`, presence dot, `HostBadge`, `EmptyState` | Who's here, who's host, presence |
| **Room — player** | `PlayerCard`, `YouTubePlayer`, `NowPlaying`, `Badge`, `SoundBars`, "Tap to unmute" / "Open on YouTube" / "Retry", `EmptyState` | Synced video playback + now-playing meta |
| **Room — queue** | `QueueList`, `QueueItem`, `AddSongDialog`, `ScrollArea`, `EmptyState`, `SoundBars`, remove `Button` | Shared, ordered up-next list + add |
| **Room — chat** | `ChatPanel`, `MessageList`, `ChatMessage` (user/system), `MessageInput`, `ScrollArea`, `Avatar`, `EmptyState` | Live back-channel |
| **Room — loading** | `RoomSkeleton`, `Skeleton`, `Logo` | No blank screen while connecting |
| **Room — closed** | `DoorClosed` state, `Button` | Graceful end-of-room |
| **Room — mobile** | `RoomLayout` (Tabs), `TabsList`/`TabsTrigger`, all four panels | Tabbed single-column experience |
| **Room — tablet** | `RoomLayout` (Sheets), `Sheet`, Player + Chat grid | Sheet-collapsed participants/queue |
| **Global** | `Toaster` (sonner), `ThemeProvider` (dark) | Toasts + locked dark theme |

---

## Appendix A — Divergences from the older `UI_UX_DESIGN.md` spec

V2 should follow **this document** (matches the shipped code + `UI.png`), not the older spec, on these points:

1. **Accent color:** Spec said primary = Spotify-green + indigo. **Shipped = violet primary + magenta accent + green only for success/in-sync/online.**
2. **Transport bar:** Spec described a custom ⏮ ▶/⏸ ⏭ control row + seek bar. **Shipped uses native YouTube controls** (host enabled / guests read-only); `PlaybackControls` + `PlaybackProgress` exist but are unmounted.
3. **Realtime toasts:** Spec listed join/leave/host-change toasts. **Shipped emits only copy + add-to-queue toasts**; presence/host changes are shown in the participant list / as system chat chips.
4. **Volume control:** Only present in the unmounted `PlaybackControls`; in V1, volume is handled by YouTube's native controls.
5. **Radius:** spec `0.75rem` → **shipped `0.85rem`** (`--radius`).
6. **Spotify playback:** typed as a provider but **no Spotify player is implemented** — only metadata would show.

---

*This reference describes UI/UX only. For product scope and behavior contracts see `PROJECT_KNOWLEDGE.md`; for implementation rules see `MMMuzik.fe/FRONTEND_GUIDELINES.md`.*
