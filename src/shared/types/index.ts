/**
 * Wire DTOs — the shared contract (single source of truth). Pure types.
 * Timestamps: ISO strings for display fields; `updatedAtUtc` is server EPOCH MS
 * (a number) so client timeline math is trivial (docs/PLAYBACK_ENGINE.md §4).
 */
export type PlaybackStatusDto = 'idle' | 'playing' | 'paused';
export type ParticipantRoleDto = 'host' | 'member';
export type RoomStatusDto = 'active' | 'idle' | 'closed';

export interface SessionDto {
  id: string;
  displayName: string;
  avatar: string | null;
}

export interface RoomDto {
  id: string;
  code: string;
  name: string;
  status: RoomStatusDto;
  hostSessionId: string;
  createdAt: string; // ISO
}

/**
 * Pre-join room summary (GET /api/rooms/code/:code) — shown on the invite/join
 * screen before a nickname is entered. `listenerCount` is the online count.
 */
export interface RoomSummaryDto {
  id: string;
  code: string;
  name: string;
  listenerCount: number;
  nowPlayingTitle: string | null;
}

export interface ParticipantDto {
  sessionId: string;
  nickname: string;
  avatar: string | null;
  role: ParticipantRoleDto;
  isOnline: boolean;
  joinedAt: string; // ISO
}

export interface PlaybackStateDto {
  roomId: string;
  status: PlaybackStatusDto;
  currentTrackId: string | null;
  currentVideoId: string | null; // YouTube 11-char id, or null when idle
  positionMs: number; // true offset AT updatedAtUtc
  updatedAtUtc: number; // server EPOCH MS — the anchor
  revision: number; // monotonic; clients reject revision <= local
}

/** GET /api/rooms/:id/playback — anchor + server clock for join-in-progress. */
export interface PlaybackSnapshotDto {
  playback: PlaybackStateDto;
  serverTimestampUtc: number; // server EPOCH MS at response time
}

export interface ClockSample {
  rttMs: number;
  offsetMs: number;
}

export interface QueueItemDto {
  id: string;
  roomId: string;
  trackId: string;
  provider: 'youtube' | 'spotify';
  videoId: string; // provider track id (YouTube 11-char)
  title: string;
  durationMs: number; // 0 = unknown until the host player reports it
  thumbnailUrl: string | null;
  position: number; // 0-based
  addedBySessionId: string;
  addedByNickname: string;
  addedAt: string; // ISO
}

/**
 * A chat message (docs/REALTIME_ENGINE.md Appendix A; docs/SPEC.md §7.11).
 * `nickname` is the sender's name AT SEND TIME (snapshot — REQ-CHAT-2), so
 * history reads correctly even after a rename or leave. No avatar on the wire:
 * the UI derives an initials avatar from the nickname.
 */
export interface ChatMessageDto {
  id: string;
  roomId: string;
  sessionId: string;
  nickname: string;
  body: string;
  sentAt: string; // ISO
}
