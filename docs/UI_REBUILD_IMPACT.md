# UI_REBUILD_IMPACT.md — File-by-file impact of the UI rebuild

> **Status:** Phase 2. Classifies every presentation file as **DELETE / REPLACE / KEEP / UNMOUNT**, plus test updates and risks.
>
> **Method.** "Rebuild in place": divergent components are **re-authored from `UI_V1_REFERENCE.md`** at their existing paths so the frozen engine wiring (imports from stores/services/hooks/contracts) stays intact. Files already conformant to the reference are **kept** (keeping them already satisfies the parity success-criteria). No files are moved (moving would break engine imports for zero visual gain).
>
> **Frozen — never touched:** `src/shared/**` (contracts/domain), `src/server/**`, `src/features/**/{store,services,hooks}`, `src/stores/**`, `src/lib/**` (except none), `prisma/**`, Docker, env, `globals.css`, `tailwind.config.ts`.

---

## 1. DELETE (obsolete)

| File | Reason |
|------|--------|
| `src/components/ui/HeroIllustration.tsx` | Not referenced anywhere (home preview is `HomePreviewCard`; only self + old migration docs mention it). Not part of `UI_V1_REFERENCE.md`. Safe to remove (unique filename — no Windows case-collision risk). |

## 2. REPLACE (re-author contents from the reference; path & exports preserved)

| File | Why it diverges from V1 | Rebuild |
|------|------------------------|---------|
| `src/features/youtube/components/YouTubePlayer.tsx` | Forces `controls:0` for **everyone**; never role-keyed | **Role-keyed**: host `controls:1, disablekb:0` + emits `playback:play/pause/seek` from native interactions (guarded against echo); guest `controls:0, disablekb:1` + follows anchor (unchanged). Keep loading poster, error hatch, drift reconcile (guest), duration/ended reporting (host). Add global first-gesture unmute (§6.6). |
| `src/components/PlaybackPanel.tsx` (= **PlayerCard**) | Mounts a **custom transport bar + seek bar + volume slider** (not in V1) | Aurora card, edge-to-edge video, `NowPlaying`, escape-hatch row, "Nothing playing" empty state. **No transport/seek/volume.** Passes `isHost` to a role-keyed `YouTubePlayer`. (§6) |
| `src/components/playback/NowPlaying.tsx` | No artwork branch | Add `showArtwork` (Spotify/no-video tile per §6.3); keep provider badge + "In sync" + title/artist. |
| `src/components/queue/QueueItem.tsx` | Has up/down **reorder chevrons** (V1 §7.5 has **no reorder UI**) | Remove chevrons + `onMoveUp/onMoveDown/isFirst/isLast` props. Keep host-only remove "X" (hover-revealed, never on current), index/SoundBars, thumbnail, title/subline, duration. (§7.2–7.4) |
| `src/components/QueueList.tsx` | Has **"Clear all"** (not in V1) | Remove "Clear all". Panel + "Add song" action + ScrollArea rows + empty state. Drop reorder wiring. (`queue:reorder`/`queue:clear` socket events remain in the contract, simply unused by UI — matches V1's "capability exists, UI doesn't expose it".) |
| `src/components/queue/AddSongDialog.tsx` | YouTube-only copy + generic Link icon | Youtube icon; "YouTube or Spotify" description + dual placeholder (§7.6). |
| `src/components/chat/ChatMessage.tsx` | Inline **"(Host)"** marker (not in V1 §5.12) | Remove the marker. Keep bubble style (self right/primary, others left/surface-2), avatar, name (others only), clock. |
| `src/components/room/CreateRoomDialog.tsx` | name maxLength 80 / nickname 40 | Align to V1 §4.2: room name **40**, nickname **24**. Re-author. |
| `src/components/room/NicknameForm.tsx` | nickname maxLength 40 | Align to V1 §4.4: **24**. |
| `src/components/room/JoinRoomDialog.tsx` | (conformant) re-authored for from-scratch fidelity | Keep code length gate at **6** (V2 `ROOM_CODE_LENGTH`, not V1's literal 4). |
| `src/components/InviteShare.tsx` | Missing documented `compact` Share2 variant | Add `compact` prop (§5.7); default behavior unchanged. |
| `src/components/room/RoomSkeleton.tsx` | Skeleton implies a transport row + `max-w-[1600px]` cap | Match the native-controls layout & full-width room grid (§4.5). |
| `src/app/page.tsx` | (conformant) re-authored from §4.1 for from-scratch fidelity | No functional change. |

## 3. UNMOUNT (keep file, no longer rendered)

| File | Note |
|------|------|
| `src/components/playback/PlaybackProgress.tsx` | V1 §5.15 keeps `PlaybackProgress` in the codebase but **not mounted**. After the PlayerCard rebuild nothing imports it. Retained as a reference component. |

## 4. KEEP (already conformant to `UI_V1_REFERENCE.md`)

- **Primitives (§5.0):** `button`, `badge`, `input`, `label`, `dialog`, `sheet`, `tabs`, `tooltip`, `slider`, `scroll-area`, `avatar`, `user-avatar`, `skeleton`, `separator`, `sonner` — verified class-for-class.
- **Brand/feedback:** `Logo`, `Panel`, `SoundBars`, `EmptyState`, `Spinner`, `ConnectionBanner`, `HostBadge`, `theme-provider`.
- **Room shell:** `RoomLayout`, `RoomHeader`.
- **Join:** `JoinRoomPanel`, `RoomInfoCard`.
- **Home:** `HomePreviewCard`.
- **Chat:** `ChatPanel`, `MessageList`, `SystemMessage`, `MessageInput`.
- **Participants:** `ParticipantList`, `ParticipantCard`.
- **Root:** `app/layout.tsx`, `app/join/[code]/page.tsx`, `app/room/[roomId]/page.tsx`.

## 5. TESTS (ship with the code — CLAUDE.md)

| Test | Action |
|------|--------|
| `tests/ui/PlaybackPanel.test.tsx` | **Rewrite** — old asserts on custom transport (Play button enabled/disabled, "host controls" notice, seek-bar `0:30`/`3:20`). New: assert now-playing metadata (title/artist/"In sync"), escape hatch ("Open on YouTube"), and "Nothing playing" empty state. Role is now inside the YT iframe → not DOM-assertable. |
| `tests/ui/ChatPanel.test.tsx` | **Edit** — drop the `(Host)` assertion (marker removed). |
| `tests/ui/QueueList.test.tsx` | **Keep** — asserts items/count/"Now playing"/"added by"/remove/empty; all still hold. No reorder assertions present. |
| `tests/ui/Home.test.tsx` | **Keep** — hero word + Create/Join triggers unchanged. |
| `tests/ui/ParticipantList.test.tsx` | **Keep** — component unchanged. |
| `tests/ui/setup.ts` | **Keep** — polyfills still valid. |
| Engine tests (`tests/unit/**`, `tests/integration/**`) | **Untouched** — no logic changed. |

## 6. RISKS & MITIGATIONS

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **Native-control host wiring** (crown-jewel sync). Host play/pause/seek → socket commands; risk of echo loops or false seek detection from the YT iframe. | High | Programmatic-action guard window around our own `playVideo/pauseVideo/seekTo`; seek emitted only on a large currentTime discontinuity while `playing`, debounced; guest follow/reconcile preserved verbatim; player **keyed by role** so transfers remount cleanly. Server protocol/sync math unchanged. |
| **No browser in CI** — can't assert YT iframe behavior automatically. | Med | `tsc` + `next build` + jsdom mount tests catch wiring/markup; **manual browser verification recommended** and noted in `UI_REBUILD_RESULT.md`. |
| **Intentional feature removals** (queue reorder UI, "Clear all", chat "(Host)" marker) reduce functionality vs current V2. | Low | Done **for V1 parity per user directive**; socket capabilities retained; each is one-line reversible. Flagged in RESULT for user review. |
| **Windows case-insensitive FS** — deleting `Avatar.tsx` would clobber `avatar.tsx`. | Low | Only deletion is `HeroIllustration.tsx` (unique name). No avatar deletions. |
| **Dangling import** of `PlaybackProgress` after unmount. | Low | Removed from PlayerCard; `tsc` confirms no remaining importer. |
| **`getSocket()` at render/module top-level** could open sockets during jsdom tests. | Low | Keep `getSocket()` calls lazy (inside event handlers/effects), matching current pattern. |

## 7. NET FILE COUNT

- Delete: **1** · Replace: **13** · Unmount: **1** · Keep: **~30** · Tests changed: **2** (1 rewrite, 1 edit).
