/**
 * Wire DTOs — the shared contract (single source of truth). Pure types.
 * Timestamps: ISO strings for display fields; `updatedAtUtc` is server EPOCH MS
 * (a number) so client timeline math is trivial (docs/PLAYBACK_ENGINE.md §4).
 */
export type PlaybackStatusDto = 'idle' | 'playing' | 'paused';
export type ParticipantRoleDto = 'host' | 'member';
export type RoomStatusDto = 'active' | 'idle' | 'closed';
export type RoomVisibilityDto = 'public' | 'private';

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
  visibility: RoomVisibilityDto;
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

/**
 * A room in the browse list (GET /api/rooms/public). Active/idle rooms of BOTH
 * visibilities are listed; private rooms are shown locked. For privacy, a private
 * room hides its `code` (join requires typing it) and its `nowPlayingTitle`.
 * Public rooms expose `code` for the one-click join. `listenerCount` is the
 * online participant count.
 */
export interface PublicRoomDto {
  id: string;
  code: string | null; // null for private rooms (must be entered to join)
  name: string;
  visibility: RoomVisibilityDto;
  listenerCount: number;
  nowPlayingTitle: string | null; // null for private rooms
  createdAt: string; // ISO
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
 * A YouTube search result (docs/features/youtube-in-app-search Phase 2). Returned
 * by GET /api/rooms/:id/search. Enriched via the Data API so the UI can show enough
 * to pick the right version AND flag what can't be added. `addable` is a UX hint —
 * the server STILL re-guards authoritatively on the actual add (Phase 1).
 */
export interface SearchResultDto {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string | null;
  durationMs: number; // 0 for a livestream
  viewCount: number | null; // popularity signal; null when unavailable
  isLivestream: boolean;
  embeddable: boolean;
  /** false → UI disables Add (livestream / un-embeddable / unavailable). */
  addable: boolean;
}

/**
 * GET /api/rooms/:id/search response. `available: false` means search is degraded
 * (no API key configured or the daily quota budget is spent) — the UI falls back to
 * pasting a YouTube link. Distinct from an empty result set (`available: true, []`).
 */
export interface SearchResponseDto {
  available: boolean;
  results: SearchResultDto[];
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
