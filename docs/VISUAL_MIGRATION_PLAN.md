# VISUAL_MIGRATION_PLAN.md — V2 → V1 visual parity

> Sequenced remediation to bring **V2** to visual parity with **V1**, ordered by
> **highest visual impact first** (impact = on-screen prominence × size of deviation).
> Companion to `VISUAL_PARITY_AUDIT.md`. **No code changes until approved.**
>
> Effort: **S** ≤30 min · **M** ~1–3 h · **L** ≥half-day. Risk = chance of regressing
> behavior/tests. "Pure CSS/markup" items are cosmetic-only (no engine/store/socket
> change) and safe.
>
> ⚑ = **decision required** (the V2 delta may be intentional; reverting it could be a
> downgrade or touch behavior). These are called out so you choose, not assumed.

---

## Priority 0 — Decisions to make before coding (⚑)

These gate the highest-impact work. Pick a stance:

1. **⚑ Player control model (drives the #1 item).**
   - **Option A — Full V1 parity:** re-enable **native YouTube controls for the host** (`controls: isHost ? 1 : 0`), **remove** V2's custom transport row + seek slider + volume slider. *Visual win = highest (35%→~90%), but changes how the host drives playback* (native scrubber events must map to `playback:seek`/play/pause). **Effort L, Risk M** — touches the host→server command path (still server-authoritative; not a downgrade if wired carefully).
   - **Option B — Keep V2 custom controls, restyle to V1 card:** keep the custom transport (a deliberate V2 design), but adopt V1's **card chrome** (aurora bg, edge-to-edge video, loading poster, always-on escape hatch, unmute icon). *Visual win = partial (35%→~70%), zero behavior change.* **Effort M, Risk Low.**
   - **Recommendation:** **B** unless you specifically want YouTube's native bar. B captures most of the visual gap with no interaction-model risk.

2. **⚑ Home right column.** Restore V1's **now-playing preview card** (mock track/progress/chat) and drop `HeroIllustration`? Or keep the illustration? V1's card is the source-of-truth look. **Recommendation: restore the preview card** (it's the single biggest Home delta), optionally keep the illustration as a fallback on very small screens.

3. **⚑ Keep-or-revert intentional V2 improvements** (each is a *deviation from V1* but arguably better / required by V2's data model). Default recommendation in parentheses:
   - Dynamic sync text "Syncing…/Out of sync" vs V1 literal "In sync" *(keep V2 — truthful)*.
   - "or Spotify" copy dropped (Add-song dialog, Home feature 2) — V2 is YouTube-only *(keep V2 copy; re-add only when Spotify ships)*.
   - Header `UserAvatar` (V1 has none) *(your call — remove for strict parity, or keep)*.
   - Queue Chevron reorder + "Clear all", chat `(Host)` marker, host-first sort *(keep — approved V2 extras)*.
   - Chat **system-message chip** + **failed-send retry**, participant **idle/amber** state — present in V1, need data V2 doesn't emit today *(defer — visual-only stubs add little)*.

Everything below assumes: Player = **Option B**, Home = **restore preview card**, improvements = **keep V2 defaults**. Adjust per your answers.

---

## P1 — Player Area  (35% → target ~90%)  🔴 highest impact

The now-playing stage dominates the room. Files: `src/components/PlaybackPanel.tsx`, `src/components/playback/NowPlaying.tsx`, `src/features/youtube/components/YouTubePlayer.tsx`.

| # | Change | Effort | Risk |
|---|---|---|---|
| 1.1 | Player **card chrome → V1**: card `surface-panel bg-aurora` with **no padding** when a video is present; video **edge-to-edge** (remove `rounded-xl`), `aspect-video max-h-[60vh]`; meta padded separately (`px-5 pb-5 sm:px-6 sm:pb-6`). | M | Low (CSS) |
| 1.2 | **Loading poster**: render `hqdefault.jpg` (or artwork) as a full-cover `<img>` until the iframe paints (kills the black flash). | M | Low |
| 1.3 | **Always-on escape hatch**: inline "Can't play here? · Open on YouTube ↗ · Retry" as muted text links (`ExternalLink`/`RotateCw` `h-3.5`), not just on error. | S | Low |
| 1.4 | **Unmute button → V1**: `rounded-full` + `Volume2 h-3.5` icon (V2 is `rounded-lg`, text-only). | S | Low |
| 1.5 | **Empty state**: use the shared `EmptyState` ("Nothing playing" / "Add a song to the queue to start the session.") instead of the inline `🎧` placeholder. | S | Low |
| 1.6 | **(Option A only)** `controls: isHost?1:0`; remove custom transport/seek/volume rows; wire native player events → `playback:*` commands. | L | M |

If Option B: keep the custom transport but the above 1.1–1.5 lift it to ~70%.

---

## P2 — Home Page  (55% → target ~95%)  ⚠️

File: `src/app/page.tsx` (+ a new preview-card component). All **pure CSS/markup**.

| # | Change | Effort | Risk |
|---|---|---|---|
| 2.1 | ⚑ **Restore the now-playing preview card** (right column): aurora blur halo, `surface-panel`, `from-primary to-accent shadow-glow` art tile + `Play`, `SoundBars` + "Now playing · in sync", "Blinding Lights / The Weeknd", 36% progress "1:12 / 3:20", two mock chat lines; `hidden lg:block`. | M | Low |
| 2.2 | **Social-proof row**: 4 overlapping gradient avatars (`-space-x-2 ring-2 ring-background`) + "**2,400+** sessions started this week". | S | Low |
| 2.3 | **Feature-card gradient tints**: per-card `from-primary/20 text-primary` · `from-accent/20 text-accent` · `from-success/20 text-success` (`bg-gradient-to-br to-transparent`); revert `<h2 text-sm>`→`<h3 text-base>`, restore `mb-4`. | S | Low |
| 2.4 | **Headline**: `font-bold`→`font-semibold`, `leading-[1.1]`→`leading-[1.05]`, add `lg:text-6xl`, restore trailing period. | S | Low |
| 2.5 | **Eyebrow pill** `bg-surface`→`bg-surface/60`, add `w-fit`; **footer** add `border-t border-border/50` + "· Built with Next.js · MMMuzik"; **vertical rhythm** `main` → `justify-center gap-16`; subcopy `max-w-md`→`max-w-xl`. | S | Low |

---

## P3 — Join Page / RoomInfoCard  (68% → target ~95%)

Files: `src/components/room/JoinRoomPanel.tsx`, `RoomInfoCard.tsx`, `NicknameForm.tsx`. **Pure CSS/markup.**

| # | Change | Effort | Risk |
|---|---|---|---|
| 3.1 | **RoomInfoCard tile → V1**: `h-14 w-14`, `bg-gradient-to-br from-primary to-accent text-white shadow-glow`, `Headphones h-7 w-7`; header `items-start gap-4`; move code+listeners row **inside** the aurora header (`mt-2`); name `<h2 text-xl font-semibold>`; eyebrow `text-xs font-medium tracking-wide`; listener pill `text-xs`/`Users h-3.5`; now-playing `Music2 text-primary`. | M | Low |
| 3.2 | **Panel centering**: `<main … justify-center>`; `px-6`→`px-4`; column `space-y-4`→`space-y-5`; loading `p-8`→`p-10`. | S | Low |
| 3.3 | **NicknameForm**: button `size="lg"`, `gap-1.5`→`gap-2`, field `space-y-1.5`→`space-y-2`. (maxLength 40 vs 24 — your call; 40 is harmless.) | S | Low |

---

## P4 — Cross-cutting avatar parity  (affects header, chat, participants)

Files: `src/lib/utils.ts`, `src/components/ui/avatar.tsx`. Cheap, wide reach.

| # | Change | Effort | Risk |
|---|---|---|---|
| 4.1 | **Match `AVATAR_GRADIENTS`** array (and hash) to V1's `src/lib/utils.ts` so the same person renders the same color in both apps. | S | Low |
| 4.2 | **`avatar.tsx`**: restore `object-cover` on `AvatarImage` and `text-xs font-semibold text-foreground` on `AvatarFallback`. | S | Low |

---

## P5 — Mobile bottom bar  (72% → ~95%)

File: `src/components/RoomLayout.tsx` (`MobileLayout`). **Pure CSS.**
- TabsList → V1 floating pill: `m-3 grid grid-cols-4 gap-1 rounded-2xl` (drop `rounded-none border-t bg-surface p-1.5`). Triggers `gap-1 py-2 text-xs` (from `gap-0.5 py-1.5 text-[10px]`). Content wrapper `overflow-hidden p-3 pb-0`; player tab non-scrolling. **Effort S, Risk Low.**

## P6 — Tablet sheets  (78% → ~95%)

File: `src/components/RoomLayout.tsx` (`TabletLayout`). **Pure CSS/markup.**
- Sheet widths → `w-80` (People) / `w-96` (Queue); **show visible `SheetTitle`s** ("Participants"/"Queue") instead of `sr-only`; flatten panels inside sheets (`border-0 shadow-none`); player `self-start` (stop the scroll wrapper). **Effort M, Risk Low.**

## P7 — Room header  (80% → ~95%)

File: `src/components/RoomHeader.tsx`. **Pure CSS/markup.**
- Title `sm:text-lg`→`sm:text-base`, size `text-base`→`text-sm`; padding `px-4 py-3 sm:px-6`→`px-3 py-2.5 sm:px-4`; border `border-border`→`/60`; `Separator h-5`→`h-6` raw divider, right divider always-visible; ⚑ **remove `UserAvatar`** for strict parity (or keep — your call). **Effort S, Risk Low.**

## P8 — Dialogs polish (Create/Join/Add-song)  (82–85% → ~95%)

Files: `src/components/room/CreateRoomDialog.tsx`, `JoinRoomDialog.tsx`, `src/components/queue/AddSongDialog.tsx`. **Pure CSS/markup.**
- Trigger icons `h-4`→`h-5`; submit buttons restore `w-full`; form spacing `space-y-3`/`1.5`→`space-y-4`/`2`; Join placeholder "ABC-123"→"7QK-2MD"; Add-song leading icon `Link`→`Youtube`. ⚑ Spotify copy + maxLengths per P0.3. **Effort S, Risk Low.**

## P9 — Now-playing block  (82% → ~92%)

File: `src/components/playback/NowPlaying.tsx`. Title `text-lg`→`text-base sm:text-lg`; badge-row `gap-2.5`→`gap-2`, `space-y-1`→`gap-1.5`. ⚑ sync-text literal vs dynamic (P0.3 — recommend keep dynamic). **Effort S, Risk Low.**

## P10 — Smaller component deltas

| Item | Change | Effort | Risk |
|---|---|---|---|
| Queue item (88%) | Subtitle: show `artist · added by` when artist known; ⚑ `--:--` placeholder vs `0:00` (keep `--:--`); Chevrons are V2 extras (keep). | S | Low |
| Message input (93%) | Add `h-10` to the input. | S | Low |
| Participants panel (92%) | Alone-state: wrap in `border-t border-border/60 p-3` div + EmptyState `py-4` (match V1 spacing). | S | Low |
| Room layout (95%) | ⚑ Remove `max-w-[1600px]` cap to fill ultra-wide like V1 (or keep — minor). | S | Low |
| Room skeleton (70%) | Use a real `<Logo>` in the header; align player skeleton to whatever P1 produces. | S | Low |
| ⚑ Participant idle state / chat system+failed states | Defer — need presence-idle + message kind/status data V2 doesn't emit. | M | M |

---

## Suggested execution order (safest → highest-value, after P0 decisions)

1. **P4** (avatar parity) — tiny, global, zero risk.
2. **P2** (Home) — first impression, pure CSS.
3. **P3** (Join card) — pure CSS.
4. **P5, P6, P7, P8, P9, P10** — pure CSS/markup polish, batch them.
5. **P1** (Player) — last and largest; do P0.1 decision first. If Option A, schedule its own verification pass (native-control → command wiring).

After each batch: `tsc --noEmit`, `vitest run tests/unit tests/ui`, `next build`, and re-screenshot the screen. Update any UI test whose copy/markup changes (e.g. Home triggers, RoomInfoCard text) in the same commit.

---

## Estimated parity after plan

| | Now | After P1–P10 (Option B) | After (Option A player) |
|---|---:|---:|---:|
| Home | 55% | ~95% | ~95% |
| Join | 68% | ~95% | ~95% |
| Player | 35% | ~70% | ~90% |
| Room (composite) | ~70% | ~88% | ~95% |
| Everything else | 80–96% | ~95–99% | ~95–99% |

*No code was modified to produce this plan. Awaiting approval (and the P0 decisions) before implementation.*
