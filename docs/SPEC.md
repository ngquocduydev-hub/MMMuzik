# SPEC.md — MMMuzik Product Specification

> **Purpose.** This document defines **what** MMMuzik must do — its product behavior, rules, and acceptance criteria — independent of any technology, framework, or code structure. It is the authoritative product contract and is sufficient to rebuild the entire product from scratch.
>
> **Source.** Derived from `PROJECT_KNOWLEDGE.md` (the single source of truth). Where this document and any future build disagree on *behavior*, this specification wins.
>
> **Audience.** Product, design, QA, and engineering teams building or validating any implementation of MMMuzik.
>
> **Conventions.** Each requirement has a stable ID (`REQ-<AREA>-<n>`). Acceptance criteria use **Given / When / Then**. "Host" = the single participant who controls playback. "Guest" / "Member" = any non-host participant. "Participant" = anyone currently in a room. All times are in coordinated universal time (UTC) unless stated otherwise.

---

## Table of Contents

1. [Product Vision](#1-product-vision)
2. [Goals & Non-Goals](#2-goals--non-goals)
3. [Personas & Core Use Cases](#3-personas--core-use-cases)
4. [Glossary & Key Concepts](#4-glossary--key-concepts)
5. [System States](#5-system-states)
6. [Cross-Cutting Requirements (Quality Attributes)](#6-cross-cutting-requirements-quality-attributes)
7. [Feature Specifications](#7-feature-specifications)
   - 7.1 [Room Management](#71-room-management)
   - 7.2 [User Session & Identity](#72-user-session--identity)
   - 7.3 [Presence & Participant List](#73-presence--participant-list)
   - 7.4 [Join In Progress (Late-Join Sync)](#74-join-in-progress-late-join-sync)
   - 7.5 [Playback Control](#75-playback-control)
   - 7.6 [Queue Management](#76-queue-management)
   - 7.7 [Auto Next (Auto-Advance)](#77-auto-next-auto-advance)
   - 7.8 [YouTube Integration](#78-youtube-integration)
   - 7.9 [Music Sources & Metadata](#79-music-sources--metadata)
   - 7.10 [Host Transfer & Failover](#710-host-transfer--failover)
   - 7.11 [Chat](#711-chat)
   - 7.12 [Reconnection](#712-reconnection)
8. [User-Facing Errors & Feedback](#8-user-facing-errors--feedback)
9. [Acceptance Test Matrix](#9-acceptance-test-matrix)

---

# 1. Product Vision

**MMMuzik** is a real-time collaborative music-listening experience. One person creates a **room**, shares a short code or invite link, and everyone who joins hears **the same song at the same position at the same moment**. Participants collaboratively build a shared **queue**, a single **host** controls playback, and everyone can **chat** live.

**Product promise:** *"Share a link. Listen together. Right now."*

The product recreates the social feeling of "sharing a pair of headphones" for people in different places, with **zero onboarding friction** — no accounts, no installs, no setup. Its differentiators are:

- **True synchronized playback** — perceived difference between any two listeners stays under one second.
- **Collaborative queue curation** — anyone can add songs.
- **Clear single-host control** — mirrors "whoever holds the aux."
- **Multiple music sources** — songs can come from more than one provider; listeners watch each provider's own player while the system synchronizes only control and position.

---

# 2. Goals & Non-Goals

## 2.1 Goals (MVP)

- Let a user start a synchronized listening session in seconds, with only a nickname.
- Keep all participants synchronized to a single shared playback position.
- Allow any participant to contribute songs to a shared queue.
- Give exactly one participant (the host) authority over playback.
- Survive brief disconnects, page refreshes, and host departures without ending the session.
- Provide a lightweight live chat alongside the music.

## 2.2 Non-Goals (explicitly out of scope for MVP)

The following are intentionally excluded and must **not** be assumed by any acceptance test:

- User accounts, registration, passwords, profiles, or login.
- Friends, followers, or a social graph. *(Public room **discovery** — browsing/joining listed public rooms — is now in scope; see [§5.3](#53-room-visibility) and REQ-ROOM-10..13.)*
- Saved playlists or persistent listening history.
- Voice, video, or emoji/reaction features in chat.
- AI recommendations or automatic DJ behavior.
- Native mobile applications (responsive web only).
- Moderation beyond the host removing content from the queue (no kick, ban, or mute).
- Payments or advertising.

> **Implication of "no accounts":** anyone holding a room's code or invite link may participate. This is acceptable for the intended trusted-audience use and is a known constraint, not a defect.

---

# 3. Personas & Core Use Cases

## 3.1 Target audience

Small, trusted groups — friends and internal teams — who want a spontaneous, synchronized listening session. The product must support up to **50 concurrent participants in a single room**.

## 3.2 Core use cases

1. **Spontaneous listening party** — one person starts a room, shares a link, and friends join within seconds to listen together.
2. **Collaborative queue building** — everyone adds tracks while the host keeps order; the group "DJs" together.
3. **Listen-along** — a host plays a track and late joiners are automatically placed at the current position mid-song.
4. **Social back-channel** — participants chat alongside the music ("skip pls", "this one's a classic").

---

# 4. Glossary & Key Concepts

| Term | Meaning |
|------|---------|
| **Room** | A shared listening space identified by a unique code and an invite link. Holds participants, a queue, playback state, and chat. |
| **Room Code** | A short, unique, shareable identifier used to join a room. |
| **Invite Link** | A shareable URL that takes a user directly to the join screen for a specific room. |
| **Host** | The single participant who controls playback and manages the queue. Exactly one per room. |
| **Guest / Member** | Any participant who is not the host. |
| **Participant** | Anyone currently present in a room (host or guest). |
| **Session / Identity** | An anonymous identity established the first time a user creates or joins a room, remembered privately by their browser for a limited period so they can reconnect or rejoin as the same person. |
| **Nickname** | A user-chosen display name. The only personal information the product collects. |
| **Queue** | The shared, ordered list of songs to be played. |
| **Current Track** | The song presently playing (or paused) in the room. |
| **Playback Position** | How far into the current track playback has progressed, measured from the start of the track. |
| **Music Provider** | An external music source (e.g., YouTube, Spotify) supplying the actual audio/video and song metadata. |
| **Reconnect Grace Period** | A short window after a participant's connection drops during which they keep their identity and (if host) their authority if they return. |
| **Authoritative Position** | The single shared playback position the room agrees on; every participant's player is aligned to it. |

---

# 5. System States

## 5.1 Room lifecycle

| State | Meaning | Allowed transitions |
|-------|---------|---------------------|
| **Active** | Room is live with at least one participant; normal operation. | → Idle, → Closed |
| **Idle** | Room exists but has no participants (or no one able to host); playback is paused/stopped. | → Active (someone joins), → Closed (inactivity) |
| **Closed** | Room is permanently ended. It rejects all new joins and any further changes. | (terminal) |

## 5.2 Playback status

| Status | Meaning |
|--------|---------|
| **Idle** | No current track (queue empty or fully drained). |
| **Playing** | A current track exists and is advancing. |
| **Paused** | A current track exists but is held at a fixed position. |

> **Note.** Playback status is a distinct three-state value (Idle / Playing / Paused). "Paused" and "no track at all" are different states and must be distinguishable to participants.

## 5.3 Room visibility

A room has a **visibility** fixed at creation (orthogonal to the lifecycle/playback states above):

| Visibility | In the browse list | How to join |
|------------|--------------------|-------------|
| **Public** (default) | Listed; name, listener count, and now-playing shown | One click from the list **or** by code / invite link |
| **Private** | Listed but **locked** (🔒); name + listener count shown, but now-playing and the **code are withheld** | By code / invite link **only** (type the code) |

> **Note.** Both visibilities appear in the browse list; visibility gates **how you join**, not whether the room is shown. A Private room's withheld code is its access control (like a password) — seeing it listed doesn't let you in. Trade-off: a Private room's existence + name + listener count are visible to anyone browsing.

---

# 6. Cross-Cutting Requirements (Quality Attributes)

These requirements apply across all features and are testable.

| ID | Requirement |
|----|-------------|
| **REQ-Q-1 (Sync accuracy)** | The perceived difference in playback position between any two participants must be **under 1 second** during steady-state playback. |
| **REQ-Q-2 (Join speed)** | From completing the join action to hearing audio, the elapsed time must be **under 2 seconds**, excluding time the music provider itself spends buffering. |
| **REQ-Q-3 (Capacity)** | A single room must support up to **50 concurrent participants** without functional degradation. |
| **REQ-Q-4 (Resilience)** | Brief disconnects must auto-recover: a returning participant is re-bound to their existing identity and re-synchronized to current playback without manual steps. |
| **REQ-Q-5 (Graceful degradation)** | If a music provider is temporarily unavailable, chat, presence, and queue management must remain usable. A failure in one capability must not take down unrelated capabilities. |
| **REQ-Q-6 (Privacy)** | The product must collect no personal information beyond a nickname. Rooms and their contents are ephemeral. |
| **REQ-Q-7 (Real-time propagation)** | All shared changes (joins, leaves, queue edits, playback changes, host changes, chat) must reflect to all participants in real time, in a consistent order. |
| **REQ-Q-8 (Abuse resistance)** | The product must resist casual abuse via reasonable rate limits on room creation, joining, track resolution, track adding, and message sending, and via input validation — without requiring accounts. Limits should fail open (favor availability) where possible. |
| **REQ-Q-9 (Responsive web)** | The product must work as a responsive web application across desktop and mobile browsers; no native app is required. |
| **REQ-Q-10 (Cross-session durability)** | Rooms must survive a server restart: participants can reconnect and resume the same room. |

**Indicative rate limits** (defaults; tunable): room creation ≈ 10 per minute per client; joining ≈ 20 per minute; track resolution ≈ 30 per minute; adding tracks ≈ 15 per minute; message sending throttled. Exceeding a limit yields a clear "too many requests" response and must never corrupt room state.

---

# 7. Feature Specifications

Each feature below specifies **Purpose**, **User Story**, **Functional Requirements**, **Acceptance Criteria**, and **Edge Cases**.

---

## 7.1 Room Management

### Purpose
Let a user instantly create a shared listening space and share it, and let the system manage that space's lifecycle from creation to close.

### User Story
> As someone who wants to listen with friends, I want to create a room and get a code and link I can share, so that others can join my session in seconds.

### Functional Requirements

| ID | Requirement |
|----|-------------|
| **REQ-ROOM-1** | A user can create a room by providing a room name (and a nickname for themselves). |
| **REQ-ROOM-2** | On creation, the system generates a **unique room code** and a **shareable invite link**, and the creator becomes the **host** and the first participant. |
| **REQ-ROOM-3** | A newly created room starts in **Active** status with playback **Idle** (no current track). |
| **REQ-ROOM-4** | The host can view and copy the room code and invite link at any time while in the room. |
| **REQ-ROOM-5** | A room has the lifecycle defined in [§5.1](#51-room-lifecycle): Active, Idle, Closed. |
| **REQ-ROOM-6** | A room with **no online participants** for a configurable grace period is automatically **removed** by a background reaper — hard-deleted, cascading its queue and chat. *(Implementation diverges from the documented close→purge model — see [ARCHITECTURE §14](ARCHITECTURE.md#14-decision-log).)* |
| **REQ-ROOM-7** | The host can explicitly **close** the room at any time; closing pauses playback and ends the room for everyone. |
| **REQ-ROOM-8** | A **Closed** room rejects all new joins and rejects every further change (queue, playback, chat). Attempts to view a closed room for the purpose of joining must clearly indicate it is unavailable (not joinable). |
| **REQ-ROOM-9** | The invite link must direct a recipient to the join screen for that specific room. |
| **REQ-ROOM-10** | On creation a room is assigned a **visibility**: **Public** (default) or **Private**. See [§5.3](#53-room-visibility). |
| **REQ-ROOM-11** | The browse list shows active/idle rooms of **both** visibilities. **Public** rooms can be **joined in one click** (no code) and show name, listener count, and current track. |
| **REQ-ROOM-12** | **Private** rooms appear in the list **locked** (🔒): name + listener count are shown, but the current track and the **code are withheld**; joining requires **typing the code** (or using the invite link). |
| **REQ-ROOM-13** | The room code / invite link works for **both** visibilities; visibility controls discoverability, not the code-join path. |

### Acceptance Criteria

- **AC-ROOM-1** — *Given* a user supplies a room name and nickname, *when* they create a room, *then* they receive a unique room code and invite link, are marked as host, and are placed into the room as its only participant with playback Idle.
- **AC-ROOM-2** — *Given* a room exists, *when* a second user joins with the same code, *then* both users are in the same room and see each other.
- **AC-ROOM-3** — *Given* an Active room, *when* its last participant leaves, *then* the room transitions toward Idle and, after the configured grace period with no online participants, the reaper **hard-deletes** it (cascading queue + chat); a would-be joiner then sees it as unavailable.
- **AC-ROOM-7** — *Given* a Public room and a Private room both exist, *when* a user opens the browse list, *then* both are listed; the Public room can be joined in one click, while the Private room shows a lock and requires the user to type its code to join.
- **AC-ROOM-4** — *Given* the host triggers close, *when* the action completes, *then* the room status becomes Closed, playback is paused, and all participants are notified the room has ended.
- **AC-ROOM-5** — *Given* a Closed room, *when* anyone attempts to join via its code or link, *then* the join is refused and the user is told the room is no longer available.
- **AC-ROOM-6** — *Given* a Closed room, *when* anyone attempts any change (add track, play, send message), *then* the change is rejected with a "room closed" message and room state is unchanged.

### Edge Cases
- Two rooms must never share a code; code generation must guarantee uniqueness or retry until unique.
- Closing an already-Closed room is a no-op (idempotent), not an error visible to the user.
- A room that auto-closes due to inactivity is indistinguishable, to a would-be joiner, from one closed by the host: both are simply "unavailable."
- Room name has a reasonable maximum length and must be rejected if empty or invalid.

---

## 7.2 User Session & Identity

### Purpose
Provide a frictionless, anonymous identity so users can participate without registration, while still being recognizable across reconnects and able to belong to more than one room.

### User Story
> As a casual user, I want to join just by typing a nickname, so that I can start listening without creating an account — and still be recognized as "me" if my connection blips.

### Functional Requirements

| ID | Requirement |
|----|-------------|
| **REQ-SESS-1** | There is **no authentication**. Identity consists of a chosen **nickname** plus an anonymous **session** remembered privately by the user's browser. |
| **REQ-SESS-2** | A joining user must provide a nickname. No other personal data is requested or stored. |
| **REQ-SESS-3** | **Duplicate nicknames are allowed.** When a nickname collides with an existing participant in the same room, the system appends a numeric suffix to keep names distinct (e.g., `Duy`, `Duy (2)`, `Duy (3)`). |
| **REQ-SESS-4** | A returning user is **re-bound to their existing participant identity** within the reconnect grace period (see [§7.12](#712-reconnection)), preserving their place and (if applicable) host status. |
| **REQ-SESS-5** | A single user's session may belong to **multiple rooms** at once (e.g., the host of one room joining a second room) without conflict. |
| **REQ-SESS-6** | Host authority is a property of identity within a room — only the participant currently designated host may perform host-only actions. Authority is enforced on every host-only action, not merely in the UI. |
| **REQ-SESS-7** | Nicknames must be validated (non-empty, reasonable length, sanitized for display). |

### Acceptance Criteria

- **AC-SESS-1** — *Given* a new visitor, *when* they create or join a room with a nickname, *then* an anonymous session is established and they participate without any account.
- **AC-SESS-2** — *Given* a participant named "Duy" is in a room, *when* another user joins the same room as "Duy", *then* the second user is shown as "Duy (2)" and both are individually identifiable.
- **AC-SESS-3** — *Given* a participant's browser already holds a session, *when* they reload the page within the grace period, *then* they rejoin as the same participant (same identity, same host status if they were host).
- **AC-SESS-4** — *Given* a user is the host of Room A, *when* they also join Room B, *then* both memberships succeed independently and neither corrupts the other.
- **AC-SESS-5** — *Given* a guest, *when* they attempt a host-only action, *then* the action is refused with a "not the host" message regardless of any client-side state.

### Edge Cases
- A reused session that joins a second room must be treated as a distinct membership per room, never as a collision.
- Nickname suffixing must continue past `(2)` if needed (`(3)`, `(4)`, …) and must remain stable for the duration of that participant's presence.
- A session whose grace period has fully expired is treated as a brand-new participant on its next join (it does not silently reclaim a prior host role).
- Leave actions must always act on the requester's own session identity, never on an identity supplied in a request parameter (a user cannot remove someone else by guessing an identifier).

---

## 7.3 Presence & Participant List

### Purpose
Show everyone who is in the room, who the host is, and reflect arrivals and departures live.

### User Story
> As a participant, I want to see who else is listening and who's in control, so that the session feels shared and I know who can change the music.

### Functional Requirements

| ID | Requirement |
|----|-------------|
| **REQ-PRES-1** | Every participant sees a live list of who is currently in the room. |
| **REQ-PRES-2** | The host is **visually distinguished** in the participant list. |
| **REQ-PRES-3** | When a participant joins or leaves, all other participants see the change in real time. |
| **REQ-PRES-4** | Each participant's online/offline state is reflected; a participant in their reconnect grace window may be shown as temporarily offline rather than removed. |
| **REQ-PRES-5** | A brief disconnect (refresh, network blip) must **not** immediately remove a participant from the list or churn the host designation. |

### Acceptance Criteria

- **AC-PRES-1** — *Given* multiple participants, *when* a new user joins, *then* all existing participants see the new user appear within real-time latency.
- **AC-PRES-2** — *Given* a participant leaves, *when* the leave completes, *then* all remaining participants see them removed.
- **AC-PRES-3** — *Given* the current host, *when* any participant views the list, *then* the host is clearly marked as such.
- **AC-PRES-4** — *Given* a participant's connection drops momentarily, *when* they return within the grace period, *then* other participants either saw a brief "offline" indicator or no change at all — never a leave followed by a re-join that loses their place.

### Edge Cases
- A participant who refreshes the page must not produce a visible "left then rejoined" flicker if they return within grace.
- The participant list must remain consistent after a host transfer (exactly one host shown at all times).
- With up to 50 participants, the list must remain readable and performant.

---

## 7.4 Join In Progress (Late-Join Sync)

### Purpose
Let someone who joins after the music has started drop straight into the current song at the correct position, so latecomers are immediately in sync.

### User Story
> As someone joining a session that's already playing, I want to hear the song from where everyone else is, so that I'm instantly part of the same moment rather than starting from the beginning.

### Functional Requirements

| ID | Requirement |
|----|-------------|
| **REQ-JOIN-1** | A user joining a room mid-song is automatically synchronized to the **current track and current position**. |
| **REQ-JOIN-2** | On join, the user receives the current playback state: which track is playing, the authoritative position, and whether playback is Playing or Paused. |
| **REQ-JOIN-3** | The system must account for differences between the joiner's local clock and the shared timeline so the joiner lands at the correct position, not a stale one. |
| **REQ-JOIN-4** | On join, the user receives current room context: participant list, current queue, and recent chat history. |
| **REQ-JOIN-5** | If playback is **Paused** when a user joins, the joiner lands paused at the same position; if **Idle**, the joiner sees no current track. |

### Acceptance Criteria

- **AC-JOIN-1** — *Given* a room playing a track at position T, *when* a new user joins, *then* their player begins at approximately position T (within the sync accuracy of [REQ-Q-1](#6-cross-cutting-requirements-quality-attributes)) and continues in step with the room.
- **AC-JOIN-2** — *Given* a room with a paused current track at position T, *when* a new user joins, *then* they see the same track paused at position T.
- **AC-JOIN-3** — *Given* a room with an idle queue, *when* a user joins, *then* they see no current track and an accurate (possibly empty) queue.
- **AC-JOIN-4** — *Given* a user joins mid-session, *when* the room screen loads, *then* they see the existing participants, the current queue, and recent chat messages without further action.

### Edge Cases
- If the track changes during the join handshake, the joiner must end on the genuinely-current track, not a stale one.
- A joiner whose local clock is significantly skewed must still land within the sync target.
- Late-join must work whether the joiner arrives via invite link or by entering the code.

---

## 7.5 Playback Control

### Purpose
Give the host clear, exclusive control of playback and keep every participant aligned to a single shared playback position.

### User Story
> As the host, I want to play, pause, seek, and skip, so that I control what the group hears — and as a guest, I want playback to just follow along automatically.

### Functional Requirements

| ID | Requirement |
|----|-------------|
| **REQ-PLAY-1** | The host can **play**, **pause**, **seek** (jump to a position), and **skip** to the next track. |
| **REQ-PLAY-2** | Playback is **synchronized across all participants**: a host action is reflected for everyone. |
| **REQ-PLAY-3** | **Non-host participants cannot control playback.** Their player follows the shared state and exposes no working transport controls. |
| **REQ-PLAY-4** | There is a single **authoritative playback position** for the room; all participants' players are continuously aligned to it. |
| **REQ-PLAY-5** | When the host pauses, the position is "banked" so that resuming continues from exactly where it paused (no lost or skipped time). |
| **REQ-PLAY-6** | When the host seeks, all participants jump to the new position. |
| **REQ-PLAY-7** | Guests' players continuously self-correct toward the authoritative position; corrections must be **smooth, not jarring** — small, expected drift is tolerated and re-seeking is avoided unless drift exceeds a threshold (target threshold ≈ 750 ms) and is rate-limited to prevent audible "thrash." |
| **REQ-PLAY-8** | "Skip to previous" restarts the current track from the beginning (there is no play history in this version). |
| **REQ-PLAY-9** | Playback state transitions follow [§5.2](#52-playback-status): Paused ⇄ Playing; Playing → (track ends or skip) → next track or Idle. |

### Acceptance Criteria

- **AC-PLAY-1** — *Given* a playing track, *when* the host pauses, *then* every participant pauses at the same position.
- **AC-PLAY-2** — *Given* a paused track, *when* the host resumes, *then* every participant resumes from the banked position, not from the start.
- **AC-PLAY-3** — *Given* a playing track, *when* the host seeks to position P, *then* every participant jumps to approximately P within the sync accuracy target.
- **AC-PLAY-4** — *Given* a guest, *when* they attempt to play/pause/seek/skip, *then* nothing changes for the room and they are not granted control.
- **AC-PLAY-5** — *Given* steady-state playback, *when* a guest's local player drifts slightly, *then* it self-corrects without repeated audible jumps, and remains within 1 second of the room.
- **AC-PLAY-6** — *Given* a host skip, *when* it completes, *then* all participants advance to the next track starting at position 0, or to Idle if the queue is empty.

### Edge Cases
- Rapid successive host actions (e.g., pause/play/seek in quick succession) must converge to a single consistent state for all participants.
- A guest's player must not "fight" a fresh host action: immediately after a host action there is a brief grace window during which guests defer to the new command rather than self-correcting against it.
- Seeking while a track is buffering or not yet started must not produce erroneous position readings; corrections are deferred until readings are reliable.
- Skip on the last track results in Idle (see [§7.7](#77-auto-next-auto-advance)).

---

## 7.6 Queue Management

### Purpose
Let the whole group collaboratively build the list of upcoming songs, while the host curates order and removal.

### User Story
> As a participant, I want to add songs to a shared queue, so that the group's music is a collective effort — and as the host, I want to remove or reorder songs to keep it on track.

### Functional Requirements

| ID | Requirement |
|----|-------------|
| **REQ-QUEUE-1** | **Any participant** can add a song by providing a music link or identifier from a supported provider. |
| **REQ-QUEUE-2** | Added songs are appended to the **end** of the queue (tail). |
| **REQ-QUEUE-3** | Each queue item displays song info (title, artist, duration, thumbnail when available) **and who added it**. |
| **REQ-QUEUE-4** | Adding the **first song to an idle queue auto-starts playback** of that song; subsequent additions never interrupt the currently playing song. |
| **REQ-QUEUE-5** | The **host** can **remove** any song from the queue and **skip** to the next song. |
| **REQ-QUEUE-6** | The **currently-playing track cannot be removed** — the host must skip it instead. |
| **REQ-QUEUE-7** | When a song is removed, the queue order is recompacted so positions stay contiguous. |
| **REQ-QUEUE-8** | The **host** can **reorder** the queue. A reorder must specify exactly the existing set of queue items, each once — no missing or extra items. |
| **REQ-QUEUE-9** | When a song finishes, the next song plays automatically (see [§7.7](#77-auto-next-auto-advance)). |
| **REQ-QUEUE-10** | All queue changes (add, remove, reorder) propagate to every participant in real time. |
| **REQ-QUEUE-11** | A provided link/identifier must be validated and resolved to song metadata before it appears in the queue; invalid or unresolvable links are rejected with a clear message and do not enter the queue. |

### Acceptance Criteria

- **AC-QUEUE-1** — *Given* any participant adds a valid song link, *when* it resolves, *then* the song appears at the end of the queue for everyone, labeled with who added it.
- **AC-QUEUE-2** — *Given* an idle queue (nothing playing), *when* a participant adds the first song, *then* that song becomes current and starts playing automatically.
- **AC-QUEUE-3** — *Given* a song is currently playing, *when* another song is added, *then* the new song is appended and the current song continues uninterrupted.
- **AC-QUEUE-4** — *Given* the host, *when* they remove a non-current song, *then* it disappears from everyone's queue and remaining positions recompact.
- **AC-QUEUE-5** — *Given* the host, *when* they attempt to remove the currently-playing song, *then* the action is refused with a "cannot remove the current track — skip instead" message.
- **AC-QUEUE-6** — *Given* a guest, *when* they attempt to remove or reorder, *then* the action is refused (host-only).
- **AC-QUEUE-7** — *Given* the host reorders with a valid complete set, *when* it completes, *then* every participant sees the new order.
- **AC-QUEUE-8** — *Given* a reorder request that omits an item or includes an unknown item, *when* submitted, *then* it is rejected and the queue is unchanged.
- **AC-QUEUE-9** — *Given* an invalid or unresolvable link, *when* a participant submits it, *then* it is rejected with a clear error and nothing is added.

### Edge Cases
- Removing the only remaining non-current item is allowed; removing the current item is always blocked.
- If a late state refresh arrives after a participant just added a song, the just-added song must not be wiped — local and incoming queue state are merged so no item is lost.
- Adding to an empty/idle queue must reliably auto-start exactly once, even under concurrent adds.
- A song whose duration is initially unknown still enters the queue; its duration is corrected once known (see [§7.9](#79-music-sources--metadata)).

---

## 7.7 Auto Next (Auto-Advance)

### Purpose
Keep the music flowing without manual intervention: when a track ends, the next one starts automatically; when the queue empties, the room rests gracefully.

### User Story
> As a participant, I want the next song to start automatically when the current one ends, so that the session keeps going without anyone having to press play each time.

### Functional Requirements

| ID | Requirement |
|----|-------------|
| **REQ-AUTO-1** | When the current track finishes, the **next queued track plays automatically**, starting at position 0 in Playing status. |
| **REQ-AUTO-2** | Auto-advance must be **reliable** even if the host's player does not explicitly report the track end (the system independently detects that the track's expected duration has elapsed). |
| **REQ-AUTO-3** | Auto-advance must be **idempotent**: duplicate or concurrent "track ended" signals for the same track must advance exactly once, never skipping an extra track. |
| **REQ-AUTO-4** | When the current track ends and there is **no next track**, playback becomes **Idle** (no current track); the room **stays open**. |
| **REQ-AUTO-5** | Adding a new track to an idle (drained) queue auto-starts it again, exactly as adding the first track does. |
| **REQ-AUTO-6** | Auto-advance propagates to all participants in real time, identically to a host skip. |

### Acceptance Criteria

- **AC-AUTO-1** — *Given* a current track with a next track queued, *when* the current track reaches its end, *then* all participants advance to the next track from the beginning automatically.
- **AC-AUTO-2** — *Given* the host's player fails to report an "ended" signal, *when* the track's duration elapses, *then* the system still advances automatically.
- **AC-AUTO-3** — *Given* both an end-of-track signal and a duration-elapsed detection fire for the same track, *when* both are processed, *then* the queue advances only once.
- **AC-AUTO-4** — *Given* the last track in the queue ends, *when* it finishes, *then* playback becomes Idle, the room remains open, and no error is shown.
- **AC-AUTO-5** — *Given* an idle (drained) queue, *when* a participant adds a song, *then* it auto-starts playing.

### Edge Cases
- A track whose true duration differs from its initially-resolved duration must advance at the corrected time, not the placeholder time.
- An "ended" signal naming a track that is no longer current is ignored (no-op), preventing accidental double-skips.
- Auto-advance must not fire while a track is merely buffering or paused — only on genuine completion.

---

## 7.8 YouTube Integration

### Purpose
Play YouTube videos in sync inside the room by embedding YouTube's own player and synchronizing control and position — without ever proxying or re-hosting the audio.

### User Story
> As a participant, I want YouTube links to just play inside the room in sync with everyone, and if YouTube blocks playback, I want an obvious way to open the video directly.

### Functional Requirements

| ID | Requirement |
|----|-------------|
| **REQ-YT-1** | The product plays YouTube content by embedding YouTube's own player; it never proxies or re-streams the audio/video itself. |
| **REQ-YT-2** | A single embedded player persists across track changes; changing tracks reuses the player rather than rebuilding it. |
| **REQ-YT-3** | The **host's** embedded player exposes native controls and drives the room: the host's play, pause, seek, and end actions become the room's playback commands. |
| **REQ-YT-4** | **Guests'** embedded players are read-only (no working transport controls) and continuously align to the room's authoritative position. |
| **REQ-YT-5** | Because browsers only allow muted autoplay, the embedded player starts **muted**; the first user interaction (tap/click/keypress) unmutes it. A clearly visible "Tap to unmute" affordance is shown while muted. |
| **REQ-YT-6** | The host's player reports the track's true duration once known, so auto-advance timing and the displayed duration are corrected (see [§7.9](#79-music-sources--metadata)). |
| **REQ-YT-7** | The host's player periodically reports its true position so the room's authoritative position tracks reality. |
| **REQ-YT-8** | An **always-available fallback** must let any participant **"Open on YouTube"** (open the video directly on YouTube) and **"Retry"** (rebuild/reload the in-room player) when in-room playback fails. |
| **REQ-YT-9** | When YouTube presents a "confirm you're not a bot" / sign-in wall, the product must clearly surface the situation and offer the "Open on YouTube" escape hatch, since this wall originates from YouTube's anti-abuse systems and cannot be bypassed from the browser. |

### Acceptance Criteria

- **AC-YT-1** — *Given* a YouTube track becomes current, *when* it loads, *then* it plays inside the room embedded player, in sync with the room.
- **AC-YT-2** — *Given* the player is muted on load, *when* the user first interacts with the page, *then* audio unmutes and the "Tap to unmute" prompt disappears.
- **AC-YT-3** — *Given* the host scrubs/pauses/plays in the native player, *when* they do so, *then* the room's playback updates for all participants accordingly.
- **AC-YT-4** — *Given* a guest, *when* they try to use the embedded player's controls, *then* playback is unaffected and follows only the room state.
- **AC-YT-5** — *Given* YouTube refuses to play (e.g., bot wall), *when* this occurs, *then* the participant sees an "Open on YouTube ↗ · Retry" option and the rest of the room (chat, queue, presence) keeps working.
- **AC-YT-6** — *Given* a track change, *when* the next track loads, *then* it reuses the existing player and starts at the correct position (0 for a fresh track) without getting stuck "loaded but paused."

### Edge Cases
- A track that initially reports no duration must still play and auto-advance correctly once its real duration is reported.
- The bot/sign-in wall is **not a product defect**: acceptance is that the product degrades gracefully and offers the direct-open hatch, not that it forces playback.
- Repeated playback failures must allow "Retry" to rebuild the player in place without requiring a full page reload.
- Muting/unmuting state must be per-user (one user unmuting does not affect others).

---

## 7.9 Music Sources & Metadata

### Purpose
Support more than one music provider and present consistent song information regardless of source.

### User Story
> As a participant, I want to add songs from the music services I use and see the title, artist, and artwork the same way no matter where the song came from.

### Functional Requirements

| ID | Requirement |
|----|-------------|
| **REQ-SRC-1** | The product supports **YouTube** as a music source. |
| **REQ-SRC-2** | The product supports **Spotify** as a music source. |
| **REQ-SRC-3** | When a participant submits a link, the product **auto-detects the provider** from the link and resolves it accordingly. |
| **REQ-SRC-4** | Song **metadata — title, artist, duration, and thumbnail/artwork — is shown consistently** regardless of provider. |
| **REQ-SRC-5** | If exact duration is not initially available from a provider, the song still enters the queue with a placeholder duration; the true duration is **corrected once measured** during playback, after which timing and the now-playing display reflect the real length. |
| **REQ-SRC-6** | If a provider is not configured or is temporarily unavailable, that source is gracefully disabled or degraded, and the rest of the product continues to function. |
| **REQ-SRC-7** | Resolved song metadata may be cached briefly to keep adding fast and reduce repeated lookups. |

### Acceptance Criteria

- **AC-SRC-1** — *Given* a YouTube link, *when* a participant adds it, *then* it resolves to a YouTube track with correct metadata and appears in the queue.
- **AC-SRC-2** — *Given* a Spotify link, *when* a participant adds it, *then* it resolves to a Spotify track with correct metadata and appears in the queue (when Spotify is configured).
- **AC-SRC-3** — *Given* a track whose duration is initially unknown, *when* it plays, *then* its displayed duration updates to the real value and auto-advance fires at the correct time.
- **AC-SRC-4** — *Given* Spotify is not configured, *when* a user attempts a Spotify link, *then* they receive a clear message that the source is unavailable, and YouTube continues to work.
- **AC-SRC-5** — *Given* tracks from different providers in one queue, *when* viewed, *then* all show title, artist, duration, and artwork in a consistent layout.

### Edge Cases
- A link that matches no supported provider, or is malformed, is rejected with a clear error.
- Upcoming (not-yet-played) tracks may display a placeholder duration until played; this is acceptable and corrected on play.
- A provider outage during adding must produce a clear "couldn't resolve this track" message, not a silent failure or a broken queue entry.

---

## 7.10 Host Transfer & Failover

### Purpose
Ensure a room always has exactly one host, and that control passes sensibly when the host leaves or disconnects — so a session never becomes uncontrollable.

### User Story
> As a participant, I want control of the music to pass to someone else automatically if the host leaves, so that the session keeps going instead of freezing.

### Functional Requirements

| ID | Requirement |
|----|-------------|
| **REQ-HOST-1** | A room has **exactly one host at all times** while it has participants. |
| **REQ-HOST-2** | The host can **explicitly transfer** host status to another current participant. After transfer, the previous host becomes a guest and the chosen participant becomes host. |
| **REQ-HOST-3** | When the host **leaves** the room, or their reconnect grace period **expires without return**, host status **automatically transfers** to the **longest-present remaining online participant**. |
| **REQ-HOST-4** | If no participant is online at the time of automatic transfer, host status passes to the **longest-present offline** remaining participant. |
| **REQ-HOST-5** | If **no participants remain**, the room goes **Idle** and playback pauses. |
| **REQ-HOST-6** | A host **disconnect** (refresh/blip) does **not** immediately trigger transfer; transfer only occurs on explicit leave or after the grace period expires (see [§7.12](#712-reconnection)). |
| **REQ-HOST-7** | A host change is reflected to all participants in real time; the new host gains host controls and the old host loses them. |
| **REQ-HOST-8** | Only the current host may initiate an explicit transfer. |

### Acceptance Criteria

- **AC-HOST-1** — *Given* a host and several guests, *when* the host explicitly transfers to a chosen guest, *then* that guest becomes host, the former host becomes a guest, and all participants see the change.
- **AC-HOST-2** — *Given* a host leaves the room, *when* the leave completes, *then* host status transfers to the longest-present remaining online participant and that participant gains host controls.
- **AC-HOST-3** — *Given* a host disconnects, *when* they return within the grace period, *then* they **retain** host status and no transfer occurs.
- **AC-HOST-4** — *Given* a host disconnects, *when* the grace period expires without their return, *then* host transfers to the longest-present remaining online participant.
- **AC-HOST-5** — *Given* the host leaves and no one else remains, *when* the leave completes, *then* the room goes Idle and playback pauses.
- **AC-HOST-6** — *Given* a guest, *when* they attempt to transfer host, *then* the action is refused.

### Edge Cases
- "Longest-present" is determined by who joined the room earliest among eligible participants.
- During the brief window of a host transfer, there must never be zero hosts or two hosts.
- If all remaining participants are offline (in grace), the longest-present offline participant becomes host so that someone is host the moment anyone returns.
- A promoted guest's player must transition into host mode (gaining native controls) without disrupting ongoing playback for the room.

---

## 7.11 Chat

### Purpose
Provide a real-time text back-channel so participants can talk alongside the music.

### User Story
> As a participant, I want to send and read messages in real time, so that we can react to the music together ("skip pls", "love this one").

### Functional Requirements

| ID | Requirement |
|----|-------------|
| **REQ-CHAT-1** | Any participant can **send and receive text messages in real time**. |
| **REQ-CHAT-2** | Each message displays the **sender's nickname** (as it was at the time of sending) and a **timestamp**. |
| **REQ-CHAT-3** | On joining, a participant is shown **recent message history** (default 50 messages, maximum 100, ordered oldest-first). |
| **REQ-CHAT-4** | Messages are validated: empty messages are rejected, and overly long messages (beyond a defined maximum, ~2000 characters) are rejected with a clear message. |
| **REQ-CHAT-5** | Message delivery preserves a consistent order for all participants. |
| **REQ-CHAT-6** | Sending is throttled to resist spam (see [REQ-Q-8](#6-cross-cutting-requirements-quality-attributes)). |
| **REQ-CHAT-7** | Chat remains usable even if music playback is degraded or a provider is unavailable. |

### Acceptance Criteria

- **AC-CHAT-1** — *Given* a participant types a message, *when* they send it, *then* all participants see it in real time with the sender's nickname and time.
- **AC-CHAT-2** — *Given* a user joins a room with prior chat, *when* the room loads, *then* they see up to the most recent 50 messages, oldest-first.
- **AC-CHAT-3** — *Given* an empty message, *when* a participant attempts to send it, *then* it is rejected and nothing is posted.
- **AC-CHAT-4** — *Given* a message longer than the allowed maximum, *when* a participant attempts to send it, *then* it is rejected with a clear "message too long" message.
- **AC-CHAT-5** — *Given* a participant sends messages rapidly, *when* they exceed the throttle, *then* further messages are temporarily refused without affecting room state.

### Edge Cases
- A message must not appear twice for a participant even if delivery is retried (messages are de-duplicated for display).
- The displayed sender nickname is a snapshot at send time; if a duplicate-suffixed nickname was used, that exact name is shown.
- Recent-history requests must clamp the requested count to the supported range (1–100).
- Chat history persists for the room's lifetime; deleted messages (if any) are excluded from history.

---

## 7.12 Reconnection

### Purpose
Make brief network interruptions invisible: participants automatically recover their place, identity, host status, and playback sync without manual steps.

### User Story
> As a participant whose connection blips, I want to automatically rejoin the same room, as the same person, in sync with the music, so that I don't lose my place or my control.

### Functional Requirements

| ID | Requirement |
|----|-------------|
| **REQ-RECON-1** | When a participant's live connection drops, the client **automatically attempts to reconnect** with escalating back-off intervals. |
| **REQ-RECON-2** | A disconnect opens a **reconnect grace period** (approximately 30 seconds, configurable) during which the participant keeps their identity and, if host, their host status. |
| **REQ-RECON-3** | If the participant returns within the grace period, they are **re-bound to their existing identity** with no loss of place, no duplicate participant, and no host churn. |
| **REQ-RECON-4** | On successful reconnect, the client **re-synchronizes**: it re-establishes presence, re-pulls the current queue and playback state, and re-aligns to the authoritative playback position. |
| **REQ-RECON-5** | If the grace period expires without return, the participant is finalized as departed; if they were host, automatic host transfer occurs (see [§7.10](#710-host-transfer--failover)). |
| **REQ-RECON-6** | During reconnection, the user is shown a clear, non-blocking indicator (e.g., a "reconnecting" banner) that clears on success. |
| **REQ-RECON-7** | Reconnection must work across a full page refresh, not only transient socket drops. |

### Acceptance Criteria

- **AC-RECON-1** — *Given* a participant's connection drops briefly, *when* connectivity returns within the grace period, *then* they automatically rejoin as the same participant, re-synced to current playback, with no manual action.
- **AC-RECON-2** — *Given* the host's connection drops, *when* they return within grace, *then* they retain host status and controls.
- **AC-RECON-3** — *Given* a participant refreshes the page, *when* it reloads within grace, *then* they resume in the same room with the same identity and current state.
- **AC-RECON-4** — *Given* a reconnection is in progress, *when* the user looks at the screen, *then* they see a clear reconnecting indicator that disappears once reconnected.
- **AC-RECON-5** — *Given* a participant who does not return before the grace period ends, *when* the period expires, *then* they are treated as having left (and host failover applies if they were host).
- **AC-RECON-6** — *Given* a reconnect succeeds, *when* the client re-syncs, *then* the queue and playback position match the rest of the room.

### Edge Cases
- A reconnect must not create a duplicate participant entry for the same person.
- A participant who reconnects after the grace period has expired is treated as a fresh join (they do not silently reclaim host).
- Reconnection back-off must not hammer the server; intervals escalate (e.g., immediate, then increasing delays up to a cap).
- If the room was Closed while a participant was disconnected, on return they are informed the room has ended rather than being placed into a dead room.

---

# 8. User-Facing Errors & Feedback

The product must communicate failures clearly and never leave shared state inconsistent. The following user-facing conditions must be handled with clear, friendly messaging:

| Condition | Expected user-facing behavior |
|-----------|-------------------------------|
| **Room not found** | "This room doesn't exist" — joining/viewing is refused. |
| **Room closed** | "This room has ended" — joins and all changes are refused. |
| **Not the host** | Host-only actions are refused with "Only the host can do that." |
| **Cannot remove current track** | "You can't remove the song that's playing — skip it instead." |
| **Empty queue on playback action** | Playback actions that require a track are refused when none exists. |
| **Invalid position (seek)** | An out-of-range seek is refused without corrupting playback. |
| **Invalid/unsupported music link** | "We couldn't recognize or load that link." |
| **Track resolution failed** | "We couldn't load that song right now." Nothing is added. |
| **Invalid queue reorder** | A reorder that doesn't match the exact current item set is refused; queue unchanged. |
| **Empty chat message** | Refused silently (nothing posted). |
| **Chat message too long** | "That message is too long." |
| **Rate limit exceeded** | "You're doing that too fast — try again in a moment." State unchanged. |
| **Music provider blocked playback (e.g., bot wall)** | Surface the situation and offer "Open on YouTube ↗ · Retry"; keep the rest of the room working. |

General rules:
- Successful actions provide lightweight confirmation where helpful (e.g., a toast "Added to the queue").
- No failure may leave the room in an inconsistent state across participants.
- Errors are phrased for non-technical users; no internal error codes are shown.

---

# 9. Acceptance Test Matrix

A high-level coverage map tying required capabilities to their acceptance criteria. An implementation is considered complete only when all rows pass.

| Capability | Key Requirements | Primary Acceptance Criteria |
|-----------|------------------|-----------------------------|
| Room Management | REQ-ROOM-1…9 | AC-ROOM-1…6 |
| User Session & Identity | REQ-SESS-1…7 | AC-SESS-1…5 |
| Presence | REQ-PRES-1…5 | AC-PRES-1…4 |
| Join In Progress | REQ-JOIN-1…5 | AC-JOIN-1…4 |
| Playback Control | REQ-PLAY-1…9 | AC-PLAY-1…6 |
| Queue Management | REQ-QUEUE-1…11 | AC-QUEUE-1…9 |
| Auto Next | REQ-AUTO-1…6 | AC-AUTO-1…5 |
| YouTube Integration | REQ-YT-1…9 | AC-YT-1…6 |
| Music Sources & Metadata | REQ-SRC-1…7 | AC-SRC-1…5 |
| Host Transfer & Failover | REQ-HOST-1…8 | AC-HOST-1…6 |
| Chat | REQ-CHAT-1…7 | AC-CHAT-1…5 |
| Reconnection | REQ-RECON-1…7 | AC-RECON-1…6 |
| Sync quality (cross-cutting) | REQ-Q-1, REQ-Q-2 | AC-JOIN-1, AC-PLAY-5 |
| Capacity (cross-cutting) | REQ-Q-3 | 50-participant room remains functional |
| Resilience & degradation | REQ-Q-4, REQ-Q-5 | AC-RECON-1, AC-YT-5, AC-SRC-4 |

---

*This specification describes product behavior only. It deliberately omits all implementation choices (data stores, transport mechanisms, frameworks, internal architecture, and code organization). Any technology that satisfies these requirements and acceptance criteria is a valid implementation of MMMuzik.*
