# UI_MIGRATION_PLAN.md — V1 → V2 UI Migration

> **Phase 3 deliverable.** A sequenced, risk-ordered plan to make **MMMuzik-v2**
> visually & functionally match **MMMuzik.fe** while keeping **all V2 architecture**.
> Derived from `UI_MIGRATION_AUDIT.md` (what V1 has) + `UI_GAP_ANALYSIS.md` (A/B/C/D).
>
> **Non-negotiable guardrails (repeated):**
> - Keep V2 Socket.IO, server-authoritative **playback / realtime / sync** engines, Zustand stores, Prisma/Postgres/Redis, Docker.
> - Playback UI stays **server-authoritative** — host *drives* via socket commands; **no** local/host playback authority, **no** local timeline.
> - Reuse existing V2 socket events / REST / stores; **extend only when necessary**; never port SignalR or V1 services.
> - Ship per V2 conventions: contract-first when backend changes, `tsc`/`eslint`/tests/`next build` green at each step.

---

## 1. Strategy

1. **Foundation first, screens last.** Land the design system (tokens, primitives, animations) before touching screens, so every later step composes stable building blocks. This is the safest possible ordering — pure addition, no behavior change.
2. **One vertical at a time, behind the same data.** Each screen/area rebinds to the **existing** V2 stores/events; we change *presentation*, not *data flow*. A regression in styling can't break realtime.
3. **Keep V2 wins.** Where V2 is ahead (engine, socket-bound controls, queue reorder/clear, chat host-marker + maxLength), we **re-skin** to V1's look but **keep the behavior**.
4. **Incremental & shippable.** Every step ends green (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`). UI tests updated in the same step (as established this session).

**Risk legend:** 🟢 low (additive/cosmetic) · 🟡 medium (re-flow/new component, data unchanged) · 🔴 high (routing change, new backend, or engine-adjacent).

---

## 2. Work order (safest → riskiest) — high level

| Phase | Theme | Risk |
|---|---|:--:|
| 0 | Design-system foundation (tokens, primitives, animations, utils) | 🟢 |
| 1 | Shared shell components (`Logo`/`Brand`, `Panel`, `EmptyState`, `Spinner`, `ConnectionBanner`, `Toaster`, `ThemeProvider`) | 🟢 |
| 2 | Playback area re-skin (keep engine + socket controls) | 🟡 |
| 3 | Queue area (AddSongDialog, item styling, EmptyState) | 🟡 |
| 4 | Participants area (card, presence dot, HostBadge) | 🟢 |
| 5 | Chat area (bubble styling, EmptyState; keep slice) | 🟡 |
| 6 | Room header + `InviteShare` + toasts | 🟡 |
| 7 | Room layout: desktop clamp → tablet `Sheet`s → mobile `Tabs` (`useBreakpoint`) | 🟡 |
| 8 | Home re-flow: Create/Join **dialogs** + hero/feature alignment | 🟡 |
| 9 | **`/join/[code]`** route + **room-summary-by-code** backend (REST) | 🔴 |
| 10 | `RoomSkeleton`, room-closed screen, deep-link guard, presence/host toasts | 🟡 |
| 11 | Mobile polish, animations pass, a11y/reduced-motion, theme toggle (optional) | 🟢 |

> Rationale: foundation (0–1) unblocks everything and can't regress behavior. Areas 2–6 are isolated re-skins on stable data. Layout (7) and Home (8) re-flow. The **only 🔴** steps are the routing change + the one new read-only endpoint (9); they're late so everything they depend on is already stable.

---

## 3. Phase detail

### Phase 0 — Design-system foundation 🟢
**Goal:** V1's visual language available as tokens/utilities; no screen changes yet.
- **Files:** `tailwind.config.ts`, `src/app/globals.css`, `src/app/layout.tsx`, `package.json`.
- **Do:**
  - Convert tokens to **HSL CSS variables** (`--background/surface/surface-2/foreground/muted/border/input/primary/accent(magenta)/success/destructive/ring/radius`), dark `:root,.dark` + `.light`; map Tailwind colors to `hsl(var())`. (Gap F1–F9)
  - Add keyframes/animations (`fade-in`, `slide-in`, `pulse-ring`, `equalizer`) + `tailwindcss-animate`; add `.bg-aurora`, `.text-gradient-brand`, `.surface-panel`; reduced-motion reset. (F10, F14, M*)
  - Add deps: `lucide-react`, `sonner`, `next-themes`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss-animate`, `@radix-ui/*` (avatar, dialog, label, scroll-area, separator, slider, tabs, tooltip, slot). (F11–F13)
  - Extend `src/lib/format.ts`/`utils`: add `cn`, `formatRoomCode`, `avatarGradient`, `initials`. (F15)
- **Reusable:** existing `format.ts`.
- **Risk:** 🟢 (existing hex tokens were close; map carefully so current components keep rendering). Verify build/tests green.

### Phase 1 — Shared shell components 🟢
**Goal:** the reusable kit V1 screens are built from.
- **New files:** `src/components/ui/{button,badge,input,label,avatar,dialog,sheet,tabs,tooltip,slider,scroll-area,separator,skeleton,sonner}.tsx` (shadcn), `src/components/layout/Panel.tsx`, `src/components/feedback/{EmptyState,Spinner,SoundBars,ConnectionBanner}.tsx`, `theme-provider.tsx`.
- **Impacted:** `app/layout.tsx` (mount `ThemeProvider` + `<Toaster/>`). `Brand` aligned to `Logo` look (keep name `Brand` to limit churn, or add `Logo`).
- **Reusable:** V2 `ConnectionStatus` → fold into `ConnectionBanner`; V2 `LoadingState` → `Spinner`/skeleton; V2 `icons.tsx` retired in favor of `lucide-react` **incrementally** (leave until each consumer migrates).
- **Risk:** 🟢 additive. Nothing references new primitives yet.

### Phase 2 — Playback re-skin 🟡 (engine untouched)
- **Files:** `src/components/PlaybackPanel.tsx`, `src/features/youtube/components/YouTubePlayer.tsx`, new `NowPlaying` sub-view.
- **Do:** wrap in `Panel`; provider `Badge` + `SoundBars` "In sync" **driven by V2's real sync state** (keep `SyncStatusIndicator` data); `Slider` seek bar emitting the **existing** `playback:seek`; `Tooltip` on host-disabled controls; add YouTube **loading poster** + host **terminal-error skip**. (P3,P4,P5,P8,P11)
- **Keep (D):** server-authoritative anchor, socket-bound play/pause/skip/restart, volume store, reorder-independent. **Do not** adopt native YT controls or V1 sync loop.
- **Reusable:** `usePlaybackStore`, `useExpectedPosition`, `playerStore`, all `playback:*` events.
- **Risk:** 🟡 — touches the player component; must not alter the reconcile/anchor logic. Add tests for control gating.

### Phase 3 — Queue 🟡
- **Files:** `src/components/QueueList.tsx`, `QueueItem` (extract), new `AddSongDialog.tsx`.
- **Do:** `Panel` wrapper; move add-form into `AddSongDialog` (Radix `Dialog`, single link field, inline error, `toast.success`) calling the **existing** `queue:add`; `QueueItem` styling (artwork, current `SoundBars`, added-by, duration, hover-reveal remove, `animate-slide-in`); `EmptyState`. (Q1,Q3,Q6,Q7)
- **Keep (D):** **reorder up/down** + `queue:reorder`, **Clear all** + `queue:clear` (V1 lacks both). Provider stays YouTube (Q2/FN5 deferred).
- **Reusable:** `useQueueStore`, `queue:*` events.
- **Risk:** 🟡 — re-style + dialog; data unchanged. Update QueueList UI test (copy/placeholder changed).

### Phase 4 — Participants 🟢
- **Files:** `src/components/ParticipantList.tsx`, new `ParticipantCard.tsx`, `HostBadge.tsx`.
- **Do:** `Panel`; `ParticipantCard` (gradient `Avatar` + overlaid presence dot + name + "(you)" + `HostBadge` crown); `{n} online` meta; "alone" `EmptyState` footer. (PA1–PA5)
- **Reusable:** `useParticipantsStore`, `presence:*` events.
- **Risk:** 🟢. Update ParticipantList UI test (badge/dot/count markup).

### Phase 5 — Chat 🟡
- **Files:** `src/components/ChatPanel.tsx`, new `MessageList.tsx`/`ChatMessage.tsx`/`MessageInput.tsx`.
- **Do:** `Panel`; bubble layout (own = `bg-primary` right, others = `bg-surface-2` left, avatar, timestamp); `EmptyState`; `ScrollArea` autoscroll. (C2,C6)
- **Keep (D):** Socket.IO chat slice, **host marker**, **maxLength**, dedupe-by-id. Reconcile "(you)" with bubble style.
- **Reusable:** `useChatStore`, `chat:send`/`chat:messagePosted`, `/api/rooms/[id]/messages`.
- **Risk:** 🟡 — re-style only. Update ChatPanel UI test.

### Phase 6 — Room header + InviteShare + toasts 🟡
- **Files:** `src/components/RoomHeader.tsx`, new `InviteShare.tsx`; subscribe toasts in `realtimeService`/a small hook.
- **Do:** `Logo` + name + `ConnectionBanner` + `InviteShare` (code chip + Copy link, `sonner` toast) + Leave (`Tooltip`). Fire `toast` on `presence:participantJoined/Left` + `presence:hostChanged`. (R5,R6,R7,FN2,FN3,S7)
- **Reusable:** `room.code`, existing presence events.
- **Risk:** 🟡 — additive; ensure toasts are deduped/not noisy.

### Phase 7 — Room layout (breakpoints) 🟡
- **Files:** `src/components/RoomLayout.tsx`, new `src/hooks/useBreakpoint.ts`.
- **Do:** desktop clamped 3-col; **tablet** = `Sheet`s (Participants/Queue) + 2-col (Player+Chat); **mobile** = bottom **`Tabs`** (Player/Queue/Chat/People). Mount one layout per breakpoint so feature hooks run once. (R1–R4)
- **Reusable:** all panels from Phases 2–5.
- **Risk:** 🟡 — structural but data-agnostic; verify hooks don't double-mount/double-subscribe.

### Phase 8 — Home re-flow 🟡
- **Files:** `src/app/page.tsx`, new `CreateRoomDialog.tsx` + `JoinRoomDialog.tsx`, `HomeHero`, `FeatureCards`; retire/redirect `src/app/create/page.tsx` + `src/app/join/page.tsx` (generic).
- **Do:** Create & Join become **dialogs** on `/` (Radix Dialog), `formatRoomCode` live-format, gradient hero text, `SoundBars` pill, V1 feature copy/icons; keep/replace `HeroIllustration` vs V1 preview card (decision needed — see §5). Create → `POST /api/rooms`; Join code → validate then route to `/join/[code]`. (N1–N3,H1,H4–H7)
- **Reusable:** `createRoom`/`joinRoom` services, `roomStore`.
- **Risk:** 🟡 — routing/flow change; keep create/join services intact. Add redirects from old routes.

### Phase 9 — `/join/[code]` + room-summary backend 🔴
- **Files:** new `src/app/join/[code]/page.tsx`, `JoinRoomPanel`/`RoomInfoCard`/`NicknameForm`; **new** `src/app/api/rooms/by-code/[code]/route.ts` + `roomService.getSummaryByCode` + `RoomSummaryDto` in contracts.
- **Do (contract-first):** add `RoomSummaryDto {id, code, name, listenerCount, nowPlayingTitle?}`; `GET /api/rooms/by-code/[code]` reusing `findRoomByCode` + participant count + playback (read-only, no engine change); `/join/[code]` renders summary + nickname → existing `POST /api/rooms/join`. (N4,N5,FN1)
- **Reusable:** `findRoomByCode`, participant repo, playback cache.
- **Risk:** 🔴 — only step adding an endpoint + a route. Read-only, additive, well-isolated. Add a service unit/integration test.

### Phase 10 — States 🟡
- **Files:** `RoomLayout` (skeleton/closed), new `RoomSkeleton.tsx`; deep-link guard in room page.
- **Do:** `RoomSkeleton` mirroring the live 3-col shell; room-closed full-screen (DoorClosed); redirect `/room/[id]` → `/join/[code]` when no session/membership. (S1,S5,N7,FN7)
- **Risk:** 🟡.

### Phase 11 — Polish 🟢
- Mobile spacing/safe-area (`dvh`), animation pass (slide-in/fade-in/pulse-ring/equalizer), `prefers-reduced-motion`, optional **light theme toggle** (`next-themes`). (M1–M6,FN6,F7)
- **Risk:** 🟢.

---

## 4. Per-screen impact matrix

| Screen | Files impacted | Components (new ∕ changed) | Reusable (V2, unchanged) | Risk |
|---|---|---|---|:--:|
| **Foundation** | `tailwind.config.ts`, `globals.css`, `layout.tsx`, `package.json`, `lib/format.ts` | +shadcn ui/*, +feedback/*, +`Panel`, +`theme-provider` | `format.ts` | 🟢 |
| **Home `/`** | `app/page.tsx`, (retire) `app/create`, `app/join` | +`CreateRoomDialog`, +`JoinRoomDialog`, ∕`HomeHero`, ∕`FeatureCards` | `roomApi` (`createRoom`/`joinRoom`), `roomStore` | 🟡 |
| **Join `/join/[code]`** | +`app/join/[code]/page.tsx`, +`api/rooms/by-code/[code]/route.ts`, `roomService`, `contracts` | +`JoinRoomPanel`,+`RoomInfoCard`,+`NicknameForm` | `findRoomByCode`, `POST /api/rooms/join`, session cookie | 🔴 |
| **Room `/room/[roomId]`** | `RoomLayout`, `RoomHeader`, +`useBreakpoint`, +`RoomSkeleton`, +`InviteShare` | ∕all panels, +`Sheet`/`Tabs` layouts | `useRoomExperience`, all stores + events | 🟡 |
| **Playback area** | `PlaybackPanel`, `YouTubePlayer` | ∕`NowPlaying`, +`Slider` seek, +poster | playback engine, `playbackStore`, `playerStore`, `playback:*` | 🟡 |
| **Queue area** | `QueueList`, +`QueueItem`, +`AddSongDialog` | ∕styling, +dialog | `queueStore`, `queue:*` (incl. reorder/clear) | 🟡 |
| **Participants area** | `ParticipantList`, +`ParticipantCard`, +`HostBadge` | ∕styling | `participantsStore`, `presence:*` | 🟢 |
| **Chat area** | `ChatPanel`, +`MessageList`/`ChatMessage`/`MessageInput` | ∕bubble styling | `chatStore`, `chat:*`, `/messages` (built this session) | 🟡 |
| **Feedback/states** | +`RoomSkeleton`, ∕`Fallback`, toasts in `realtimeService` | +`EmptyState`,+`Spinner`,+`ConnectionBanner`,+`Toaster` | `connectionStore`, presence/host events | 🟡 |

---

## 5. Open decisions (need a call before/at the relevant phase)

1. **Home hero visual** — adopt V1's **product-preview card** (now-playing mock) or keep this session's **`HeroIllustration`** (headphone characters)? *Recommendation: keep `HeroIllustration` as the left/right art (it's on-brand and original) OR add the preview card to match V1 exactly. Pick one.* (Phase 8)
2. **shadcn adoption depth** — install the full primitive set (recommended; matches V1 1:1, additive, no engine impact) vs. hand-roll equivalents. *Recommendation: install shadcn primitives.* (Phase 0/1)
3. **`lucide-react` vs keep custom icons** — *Recommendation: adopt `lucide-react`* (superset; retire `icons.tsx` incrementally). (Phase 0)
4. **Light theme** — ship the toggle now or defer? *Recommendation: include `.light` tokens + `ThemeProvider` in Phase 0/1, defer the visible toggle to Phase 11.*
5. **Routes** — confirm retiring `/create` and the generic `/join` (replaced by home dialogs + `/join/[code]`), with redirects for any existing links. (Phase 8/9)
6. **System chat messages / failed-retry** — build now or defer? (V1's are non-functional.) *Recommendation: defer (optional FN4/C8/C9).*

---

## 6. Definition of done (per phase)

- Behavior matches V1 for that surface; **V2 engine/stores/events untouched** (or extended additively + documented).
- `pnpm typecheck` · `pnpm lint` · `pnpm test` (unit+UI) · `pnpm build` all green.
- UI tests updated for changed copy/markup in the same step.
- No hardcoded hex (consume tokens); icon buttons have `aria-label`; loading/empty/error present for every async surface.
- Docs touched if a contract changed (Phase 9 only): `contracts`, `REALTIME_ENGINE.md`/`DATABASE.md` as applicable.

---

*Awaiting approval before Phase 0 implementation begins (per the Phase-4 instruction: do not start until the audit is approved).*
