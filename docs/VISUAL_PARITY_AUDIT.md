# VISUAL_PARITY_AUDIT.md — V1 (MMMuzik.fe) vs V2 (MMMuzik-v2)

> **Scope.** A *visual-only* parity audit. Functionality, architecture, realtime, and
> playback engines are **out of scope** by request. Every claim is backed by reading
> **both** repos' component source and diffing exact Tailwind classes, token values,
> copy strings, icons, dimensions, gradients, shadows, radii, and animations.
>
> **Method (read this).** Neither stack can be run headlessly here (V1 = .NET/SignalR
> backend; V2 = Postgres+Redis+custom server), so this is **not** a pixel screenshot
> diff. It is a **source-level visual diff** — the most reliable proof available without
> a live render. Scores are computed from concrete class/structure/copy deltas weighted
> by on-screen prominence. Where a delta only manifests under a specific data/state, it
> is noted. **Parity is proven per item, never assumed.**
>
> V1 = `D:\Learning\MMMuzik\MMMuzik.fe` · V2 = `D:\Learning\MMMuzik-v2`.

---

## 0. Scoreboard

| Screen / Section | Visual Match | Verdict |
|---|---:|---|
| **Design system / tokens** | **99%** | Near-exact port (tokens + primitives byte-identical) |
| Home Page | **55%** | ⚠️ Major divergence |
| Join Page (`/join/[code]`) | **68%** | Noticeable divergence (hero card) |
| Create / Join dialogs | **84%** | Close; small deltas |
| **Player Area** | **35%** | 🔴 **Largest divergence — different player model** |
| Now-Playing block | **82%** | Close (YouTube case) |
| Room Layout (desktop) | **95%** | Near-identical |
| Room Header | **80%** | Close; V2 adds avatar + bigger title |
| Tablet Layout | **78%** | Sheet width/title/panel deltas |
| Mobile Layout | **72%** | Bottom tab-bar restyled |
| Room Skeleton | **70%** | Player skeleton intentionally differs |
| Queue Panel | **95%** | Near-identical |
| Queue Item | **88%** | Subtitle/duration/host-controls deltas |
| Add-Song Dialog | **82%** | Icon + Spotify copy + spacing |
| Chat Panel | **96%** | Near-identical |
| Chat Message | **84%** | Missing system/failed states; palette |
| Message Input | **93%** | Missing `h-10` |
| Participants Panel | **92%** | Near-identical |
| Participant Card | **90%** | Missing idle/amber state; palette |

**Two screens are not at visual parity: the Player Area (35%) and the Home Page (55%).** Everything else is "recognizably the same design with measurable drift." A handful of **cross-cutting** deltas (avatar gradient palette, `avatar.tsx` fallback classes, tighter dialog spacing, smaller trigger icons, dropped Spotify copy) affect multiple screens.

---

## 1. Design System / Tokens — **99%**

**Identical (proven byte-for-byte):** every dark + light CSS variable (`--background 240 18% 7%`, `--surface 240 14% 11%`, `--surface-2 240 12% 15%`, `--primary 258 90% 66%`, `--accent 326 84% 64%`, `--success 142 71% 45%`, `--destructive 0 72% 55%`, `--ring`, `--radius 0.85rem`, all `*-foreground`). Utilities `.bg-aurora`, `.text-gradient-brand`, `.surface-panel`, `.scrollbar-thin`, focus ring, reduced-motion. Tailwind: color map, radius scale, `boxShadow.glow`/`panel`, animations `fade-in`/`slide-in`/`pulse-ring`/`equalizer`, `tailwindcss-animate`. Primitives **byte-identical**: `button` (7 variants incl. `shadow-glow`+`active:scale-[0.98]`, 6 sizes), `badge` (6 variants), `input`, `dialog`, `sheet`, `tabs`, `tooltip`, `slider`, `scroll-area`, `skeleton`, `sonner`, `separator`, `label`. Shared `Logo`, `Panel`, `EmptyState`, `SoundBars`, `Spinner`, `ConnectionBanner` byte-identical. Font: Inter via `next/font`, `display:swap`, same ThemeProvider (dark default).

**Different:**
- `avatar.tsx` — **the one non-identical primitive (80%):** V2 `AvatarImage` dropped `object-cover` (non-square images stretch instead of crop); V2 `AvatarFallback` dropped `text-xs font-semibold text-foreground` from its base. (V2's `user-avatar.tsx` wrapper re-applies font/size, so consumers are mostly OK, but the bare primitive differs.)
- Font CSS-var renamed `--font-sans` → `--font-inter` (self-consistent; no visual effect) + extra `-apple-system` fallback.
- `<body>` lost `min-h-dvh` (V2 sets it per-page); `font-sans` moved from `layout.tsx` body to a globals `@apply` (no net effect).
- V2 dropped unused `accordion-down/up` keyframes (no accordion exists — dead config in V1).

**Missing in V2:** none. **Extra in V2:** `HeroIllustration`, `user-avatar`.

---

## 2. Home Page (`/`) — **55%** ⚠️

**Identical:** `Logo size="md"` + header tagline "Listen together, in sync."; hero grid ratio `lg:grid-cols-[1.05fr_0.95fr]`; eyebrow pill (`SoundBars` + "Real-time listening rooms"); gradient word `together` via `.text-gradient-brand`; subcopy sentence verbatim; CTA order (Create, then Join); 3 feature cards with titles "In perfect sync / A shared queue / Chat in real time".

**Different (exact):**
- **Headline:** V1 `font-semibold leading-[1.05] sm:text-5xl lg:text-6xl` ending with a period (`…in real time.`). V2 `font-bold leading-[1.1] sm:text-5xl` (drops `lg:text-6xl`, no trailing period). → V2 headline is smaller on large screens, heavier weight, no period.
- **Eyebrow pill:** V1 `bg-surface/60 w-fit`; V2 `bg-surface mb-5` (more opaque, different margin).
- **Subcopy:** V1 `max-w-xl` left-aligned; V2 `max-w-md mx-auto … lg:mx-0` (narrower, centered on mobile).
- **Feature-card icon tiles:** V1 per-card gradient tints — `from-primary/20 text-primary`, `from-accent/20 text-accent`, `from-success/20 text-success` (each `bg-gradient-to-br to-transparent`, `mb-4`). V2 **all three identical**: `bg-primary/15 text-primary`, no gradient, no per-card color. Title `<h3 text-base>`→`<h2 text-sm>`.
- **CTA trigger icons:** `h-5 w-5` (V1) → `h-4 w-4` (V2).
- **Footer:** V1 `border-t border-border/50` + "No account needed. Just a nickname. · Built with Next.js · MMMuzik". V2 no border + "No account needed. Just a nickname." (suffix dropped).
- **Vertical rhythm:** V1 `main` is `justify-center gap-16` (hero vertically centered, fixed gap to features). V2 hero `flex-1`, features in a `pb-12` section — no centering, different rhythm.

**Missing in V2 (the big ones):**
1. **The right-column "now-playing preview card"** — V1 shows a rich decorative mock: aurora blur halo (`-inset-6 … bg-aurora blur-2xl`), `surface-panel` with an 80×80 `from-primary to-accent shadow-glow` art tile + `Play` icon, `SoundBars` + "Now playing · in sync", **"Blinding Lights" / "The Weeknd"**, a 36%-filled progress bar with **1:12 / 3:20**, and two mock chat lines ("this playlist is unreal 🔥", "been on repeat all week"). **V2 replaced this entirely with `HeroIllustration`** — a static SVG of two people in headphones (no track, progress, chat, or sound bars). Completely different right column.
2. **Social-proof row** — V1: 4 overlapping gradient avatars (`-space-x-2`, `ring-2 ring-background`) + "**2,400+** sessions started this week". **Absent in V2.**

**Different behavior:** V1 preview is `hidden lg:block` (desktop-only); V2 illustration always visible. V1 has 3 animated `SoundBars` (eyebrow + 2 in preview); V2 has 1 (eyebrow).

**Score 55%** — left column close; right column + below-CTA region substantially different; feature gradients flattened; headline/footer drift.

---

## 3. Join Page (`/join/[code]`) — **68%**

**Identical:** `bg-aurora` background, `Logo href="/" size="md"`, three states (loading/error/loaded), loaded structure (`RoomInfoCard` + `surface-panel p-5` around `NicknameForm` + caption), caption verbatim ("No account needed — your nickname is your identity in the room."), error state (AlertTriangle tile, "Room not found", "Back to Home").

**Different (exact):**
- **Not vertically centered:** V1 `<main … justify-center …>`; V2 omits `justify-center` (card sits just under the logo instead of mid-screen). V1 `px-4`, V2 `px-6`; column `space-y-5`→`space-y-4`; loading `p-10`→`p-8`.
- **`RoomInfoCard` — the biggest Join delta:**
  | Element | V1 | V2 |
  |---|---|---|
  | Header align | `items-start gap-4` | `items-center gap-3` |
  | Icon tile | `h-14 w-14`, `bg-gradient-to-br from-primary to-accent text-white shadow-glow` | `h-12 w-12`, `bg-primary/15 text-primary` (flat, no glow) |
  | Icon | `Headphones h-7 w-7` | `h-6 w-6` |
  | Eyebrow | `text-xs font-medium tracking-wide` | `text-[10px] font-semibold tracking-widest` |
  | Name | `<h2 text-xl font-semibold>` | `<h1 text-lg font-bold>` |
  | Code+listeners row | inside aurora header (`mt-2`) | separate strip below header (`px-5 pb-4`) |
  | Listener pill | `text-xs`, `Users h-3.5` | `text-sm`, `Users h-4` |
  | Now-playing icon | `Music2 text-primary` | inherits muted |
- **`NicknameForm`:** `maxLength` 24→40; button lost `size="lg"`; `gap-2`→`gap-1.5`; field `space-y-2`→`space-y-1.5`.

**Missing in V2:** the prominent gradient+glow headphones tile (flattened). **Score 68%** — same states/copy, but the hero card and centering visibly differ.

---

## 4. Create / Join Dialogs — **84%** (Create 85% · Join 83%)

**Identical:** Create trigger "Create a room" + `Plus`; title `Radio text-primary` + "Create a room"; desc "Start a session and invite friends with a link. You'll be the host."; fields Room name / Your nickname (placeholders "Friday Vibes" / "DJ Duy"); submit "Create & enter room" / "Creating…". Join trigger "Join a room" (secondary) + `LogIn`; title `LogIn text-primary`; desc "Enter the room code a friend shared with you."; centered code input `text-center text-lg tracking-[0.3em]`; submit "Continue" / "Checking…"; clear-error-on-close.

**Different (exact):**
- Trigger icons `h-5 w-5` → `h-4 w-4` (both dialogs).
- Form spacing `space-y-4`/`space-y-2` → `space-y-3`/`space-y-1.5`.
- Submit buttons lost `w-full` → auto-width/right-aligned in footer (V1 full-width).
- Create maxLengths: name 40→80, nickname 24→40.
- Join placeholder "7QK-2MD" → "ABC-123"; V2 input has **no `maxLength`**; enable gate 4→6 chars.

**Score 84%** — copy/structure match; spacing, icon size, and the full-width submit are the visible deltas.

---

## 5. Player Area — **35%** 🔴 (largest divergence)

This renders as **two different players**. Proven from source:

- **Transport model is opposite.**
  - **V1**: `YouTubePlayer` sets `controls: isHost ? 1 : 0` → the **host sees YouTube's native control bar** (scrubber/play/pause) inside the iframe. `PlayerCard` imports **only** `NowPlaying` + `YouTubePlayer` — it does **not** mount any custom control row. (`PlaybackControls.tsx`/`PlaybackProgress.tsx` exist in V1 but are dead/unmounted.) On screen below the video: just the meta block + an always-visible escape-hatch row.
  - **V2**: `YouTubePlayer` forces `controls: 0` for everyone (chromeless), and `PlaybackPanel` **draws a full custom transport row** (Shuffle[disabled] · Restart · Play/Pause `icon-lg` · Skip · Repeat[disabled]) **+ a custom seek `Slider` + a volume mute+`Slider` row + a "The host controls playback for everyone." hint**.
- **Player card chrome.** V1: `bg-aurora` card, **zero padding** with the video **edge-to-edge** (no rounded corners), `aspect-video max-h-[60vh]`, meta padded separately. V2: plain `surface-panel … p-4 sm:p-5`, video is a **`rounded-xl` inset** (no `max-h-[60vh]`), no aurora.
- **Escape hatch.** V1: **always-visible** inline row "Can't play here? · Open on YouTube ↗ · Retry" (text links, `ExternalLink`/`RotateCw` `h-3.5`). V2: **only on hard error**, as an overlay with `bg-primary` button + outline Retry + text arrow `↗`.
- **Loading poster.** V1 shows `hqdefault.jpg` (or artwork) as a full-cover `<img>` until paint (no black flash). **V2 has none** (black box until iframe paints).
- **Unmute button.** Both bottom-right "Tap to unmute". V1 `rounded-full` **with `Volume2` icon**; V2 `rounded-lg`, **text-only** (no icon).
- **Empty state.** V1 shared `EmptyState` ("Nothing playing" / "Add a song to the queue to start the session."). V2 inline `🎧` emoji placeholder inside the black box + plain `<h2>` ("…to start.") — different copy/icon.

**Missing in V2:** native host controls, always-on escape hatch, loading poster, `bg-aurora` card, unmute icon + pill shape, `max-h-[60vh]`. **Extra in V2:** custom transport row, seek slider, volume slider, host hint, rounded video, padded card. **Score 35%.**

> **Decision flag (for the Plan):** matching V1's player visually means **re-enabling native YouTube controls for the host and removing V2's custom transport row**, which is partly an interaction-model change (not purely cosmetic). The Plan offers two options.

---

## 6. Now-Playing Block — **82%**

**Identical (YouTube case):** provider `Badge variant="secondary"` ("YouTube"), `SoundBars playing={isPlaying}` + sync text in `text-success`, title `<h2 truncate font-semibold>`, artist `<p text-sm text-muted-foreground>`.

**Different:** V1 sync text is the literal **"In sync"** always; V2 is dynamic via `classifySyncHealth(rttMs)` → "In sync"/"Syncing…"/"Out of sync" (text changes, color stays success). Title size: V1 responsive `text-base sm:text-lg`, V2 fixed `text-lg`. V2 conditionally renders badge/artist; V1 always. **Missing in V2:** album-artwork rendering capability (`h-24…sm:h-40 rounded-2xl shadow-glow` tile + `showArtwork`/size props) — latent for YouTube (meta-only either way). **Score 82%.**

---

## 7. Room Layout (desktop) — **95%**

**Identical:** grid `grid-cols-[clamp(220px,18vw,280px)_minmax(0,1fr)_clamp(300px,24vw,360px)]`, `gap-3 p-3`, center column `flex min-h-0 flex-col gap-3` (player over queue). **Different:** V2 wraps in `mx-auto … max-w-[1600px]` (centers/caps on ultra-wide; V1 fills edge-to-edge); minor `min-h-0` placement. **Score 95%.**

## 8. Room Header — **80%**

**Identical:** `Logo size="sm" showWordmark={false}`, `ConnectionBanner hidden sm:inline-flex`, leave button (`ghost`/`icon`, `LogOut h-4`, tooltip "Leave room", hover destructive), truncating room name. **Different:** V2 adds a **`UserAvatar`** (V1 has none); title `sm:text-base`→`sm:text-lg` (larger); padding `px-3 py-2.5 sm:px-4`→`px-4 py-3 sm:px-6` (taller); dividers `Separator h-5` (both `hidden sm:block`) vs V1 raw `h-6` (right divider always visible); border `/60`→full. **Score 80%.**

## 9. Tablet Layout — **78%**

**Identical:** two `secondary`/`sm` sheet triggers (People left, Queue right) + 2-col `[minmax(0,1fr)_320px]` player+chat. **Different:** sheet widths `w-80`/`w-96` → both `w-3/4 sm:max-w-sm`; **V1 shows visible sheet titles** ("Participants"/"Queue") — **V2 hides them `sr-only`**; V1 flattens panels inside sheets (`border-0 shadow-none`), V2 keeps the bordered `surface-panel`; V1 player `self-start` (top-hugging), V2 player cell scrolls. **Score 78%.**

## 10. Mobile Layout — **72%**

**Identical:** `Tabs` with 4 tabs Player/Queue/Chat/People, same icons/order. **Different (the visible delta):** bottom bar — V1 **floating pill** `m-3 grid grid-cols-4 gap-1 rounded-2xl` → V2 **flush bordered bar** `rounded-none border-t border-border bg-surface p-1.5`; triggers `flex-col gap-1 py-2 text-xs` → `gap-0.5 py-1.5 text-[10px]` (smaller labels); V1 player tab doesn't scroll, V2 player tab scrolls. **Score 72%.**

## 11. Room Skeleton — **70%**

**Identical:** shell `flex h-dvh flex-col`, same grid template, participants (5 rows) + chat (6 bubbles) columns. **Different:** V1 header uses a **real `Logo`** + text skeleton; V2 uses skeleton circle + avatar placeholder. Player skeleton: V1 **art-row** (`h-24 w-24 sm:h-40 sm:w-40` tile + text), V2 **video-box** (`aspect-video rounded-xl`) — each correctly mirrors its own player. V1 queue skeleton always visible; V2 `hidden lg:flex`. **Score 70%** (low prominence — shown ~1s).

## 12. Queue Panel — **95%** / Queue Item — **88%**

**Panel identical:** `Panel` title "Queue" + `ListMusic`, meta "{n} up next", `flush`, empty state ("Queue's empty" / "Add the first song to get the room going."), scroll container. **Panel different:** V2 adds host-only **"Clear all"** link in the action row (V2 extra).
**Item identical:** row chrome `group … animate-slide-in`, current highlight `bg-primary/10 ring-1 ring-inset ring-primary/30`, 10×10 artwork, title color, `SoundBars` for current, "Now playing" subtitle.
**Item different:** subtitle — V1 `${track.artist} · added by ${addedByName}` (artist always); V2 `${secondary ? secondary+' · ' : ''}added by ${addedByNickname}` (**omits `artist ·` when title has no " - "**). Duration — V1 always `formatDuration`; V2 `--:--` when unknown. **V2 extras:** ChevronUp/Down reorder buttons (V1 has only reveal-on-hover remove; always shows remove incl. current). **Scores 95% / 88%.**

## 13. Add-Song Dialog — **82%**

**Identical:** trigger "Add song" + `Plus h-4`; title `ListPlus text-primary` + "Add a song"; label "Song link"; leading-icon positioning; Cancel ghost; submit "Add to queue"/"Adding…"; toast "Added to the queue". **Different:** leading icon **`Youtube` → `Link`**; description + placeholder **drop "or Spotify"** (V2 YouTube-only); spacing `space-y-4`/`2` → `space-y-3`/`1.5`. **Score 82%.**

## 14. Chat Panel — **96%** / Chat Message — **84%** / Message Input — **93%**

**Panel identical** (title "Chat" + `MessageCircle`, `flush`, list+input). Panel diff: V2 hardcodes `h-full`, no `showHeader` prop.
**Message identical:** bubble geometry `rounded-2xl px-3 py-2`, self `rounded-br-md bg-primary text-primary-foreground` right-aligned, other `rounded-bl-md bg-surface-2`, `max-w-[78%]`, `h-7` avatar, sender name for others only, timestamp `text-[10px] tabular-nums`. **Message different / missing in V2:** **no system-message chip** (V1: centered `rounded-full bg-surface-2 … text-muted-foreground`); **no failed-send UI** (V1: `AlertCircle` + "Failed to send · tap to retry"). **V2 extra:** `(Host)` accent marker. Avatar adds `font-semibold`+`mb-0.5`; **avatar gradient palette differs** (see §15).
**Input identical:** form `border-t border-border/60 p-3`, placeholder "Message the room…", `SendHorizonal` send. **Input different:** V2 input **missing `h-10`** (may render shorter); V2 adds `maxLength`/`disabled`. **Scores 96% / 84% / 93%.**

## 15. Participants Panel — **92%** / Participant Card — **90%**

**Panel identical:** `Panel` "Participants" + `Users`, meta "{n} online", `flush`, alone-state copy ("You're the only one here" / "Share the room link to listen together."). Panel diff: alone-state padding wrapper (`p-3` div in V1 vs border on EmptyState in V2); V2 explicit host-first sort (extra); `h-full`.
**Card identical:** row `group … hover:bg-surface-2`, presence dot `-bottom-0.5 -right-0.5 h-3 w-3 border-2 border-surface`, online `bg-success` / offline `bg-muted-foreground/50`, name + "(you)", `HostBadge` (Crown + "Host" accent). **Card different / missing in V2:** **no idle/amber presence state** (V1 has `idle → bg-amber-400` "Idle"; V2 is binary online/offline). **Scores 92% / 90%.**

---

## 16. Cross-cutting deltas (affect multiple screens)

1. **Avatar gradient palette mismatch** — V1 and V2 ship **different `AVATAR_GRADIENTS` arrays** (and different hash, though mathematically equal). The same person can render a **different avatar color** in V2 vs V1, everywhere avatars appear (header, chat, participants).
2. **`avatar.tsx` primitive** lost `object-cover` + fallback `text-xs font-semibold text-foreground` (§1).
3. **Trigger-icon size** `h-5`→`h-4` and **full-width submit buttons lost** across Create/Join dialogs.
4. **Dialog/form spacing tightened** (`space-y-4`→`space-y-3`) across all dialogs.
5. **"or Spotify" copy dropped** (Add-song dialog, Home feature card 2) — V2 is YouTube-only in copy.
6. **Vertical centering removed** on Home `main` and Join panel (V1 centers; V2 top-aligns).

---

## 17. Per-screen requirement coverage

Every screen below was evaluated for the 6 required dimensions — (1) screenshot-equivalent (source render) comparison, (2) identical, (3) different, (4) missing components, (5) different styling, (6) different behavior — in §2–§15 above. Match scores assigned per §0. Sequenced remediation → `VISUAL_MIGRATION_PLAN.md`.

*No code was modified to produce this audit.*
