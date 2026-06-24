import type { ApiResponse } from '../http/response';
import type { PlaybackStateDto, ParticipantDto, QueueItemDto, ChatMessageDto } from '../types';

/**
 * Typed Socket.IO event maps — the realtime contract (REALTIME §6).
 * Phase 3 scope: room membership + playback commands + clock sync only.
 */
export interface ClientToServerEvents {
  'room:join': (
    payload: { roomId: string },
    ack: (res: ApiResponse<{ joined: true }>) => void,
  ) => void;
  'room:leave': (
    payload: { roomId: string },
    ack: (res: ApiResponse<{ left: true }>) => void,
  ) => void;

  'playback:play': (
    payload: { roomId: string },
    ack: (res: ApiResponse<PlaybackStateDto>) => void,
  ) => void;
  'playback:pause': (
    payload: { roomId: string },
    ack: (res: ApiResponse<PlaybackStateDto>) => void,
  ) => void;
  'playback:seek': (
    payload: { roomId: string; positionMs: number },
    ack: (res: ApiResponse<PlaybackStateDto>) => void,
  ) => void;
  'playback:skip': (
    payload: { roomId: string },
    ack: (res: ApiResponse<{ ok: true }>) => void,
  ) => void;
  'playback:trackEnded': (
    payload: { roomId: string; endedItemId: string },
    ack: (res: ApiResponse<{ ok: true }>) => void,
  ) => void;
  // Play-time recovery: the current track can't play. ONLY the host's report drives
  // a room-wide auto-skip (idempotent); a guest's player error is handled locally
  // (docs/features/youtube-in-app-search Phase 1).
  'playback:trackError': (
    payload: { roomId: string; itemId: string },
    ack: (res: ApiResponse<{ ok: true }>) => void,
  ) => void;
  'playback:reportDuration': (
    payload: { roomId: string; queueItemId: string; durationMs: number },
    ack: (res: ApiResponse<{ ok: true }>) => void,
  ) => void;

  // queue (Phase 6) — add is any participant; remove/reorder/clear are host-only.
  // allowDuplicate: re-send with true after the client confirms a QUEUE_DUPLICATE
  // warning (warn-not-block; docs/features/youtube-in-app-search Phase 1).
  'queue:add': (
    payload: { roomId: string; urlOrId: string; allowDuplicate?: boolean },
    ack: (res: ApiResponse<QueueItemDto>) => void,
  ) => void;
  'queue:remove': (
    payload: { roomId: string; queueItemId: string },
    ack: (res: ApiResponse<{ ok: true }>) => void,
  ) => void;
  'queue:reorder': (
    payload: { roomId: string; orderedIds: string[] },
    ack: (res: ApiResponse<{ ok: true }>) => void,
  ) => void;
  'queue:clear': (
    payload: { roomId: string },
    ack: (res: ApiResponse<{ ok: true }>) => void,
  ) => void;
  // Ephemeral "I'm adding/searching" signal — fire-and-forget, NOT persisted.
  // The server re-broadcasts to others as `presence:adding` (Phase 5 social cue).
  'queue:activity': (payload: { roomId: string }) => void;

  // chat (SPEC §7.11) — any participant can send; history comes via REST snapshot
  'chat:send': (
    payload: { roomId: string; body: string },
    ack: (res: ApiResponse<ChatMessageDto>) => void,
  ) => void;

  'system:ping': (payload: { t0: number }) => void;
}

export interface ServerToClientEvents {
  'playback:stateChanged': (payload: PlaybackStateDto) => void;
  'system:pong': (payload: { t0: number; serverEpochMs: number }) => void;

  // queue (Phase 6) — queue:updated is the authoritative full snapshot
  'queue:updated': (payload: { roomId: string; queue: QueueItemDto[] }) => void;
  'playback:nextTrack': (payload: { roomId: string; item: QueueItemDto }) => void;

  // chat (SPEC §7.11) — R2 reconcilable broadcast; clients dedupe by message id
  'chat:messagePosted': (payload: { roomId: string; message: ChatMessageDto }) => void;

  // presence (Phase 4)
  'presence:participantJoined': (payload: { roomId: string; participant: ParticipantDto }) => void;
  'presence:participantLeft': (payload: { roomId: string; sessionId: string }) => void;
  'presence:participantOnline': (payload: { roomId: string; sessionId: string }) => void;
  'presence:participantOffline': (payload: { roomId: string; sessionId: string }) => void;
  'presence:hostChanged': (payload: { roomId: string; newHostSessionId: string }) => void;
  // Ephemeral "X is adding a song" cue (Phase 5). Convergent, keyed by sessionId,
  // never persisted; clients resolve the nickname from the participants store and
  // auto-expire the cue. Broadcast to OTHERS only (sender-excluded).
  'presence:adding': (payload: { roomId: string; sessionId: string }) => void;
  'room:closed': (payload: { roomId: string; reason: string }) => void;
}

/** Per-socket data bound at the handshake (REALTIME §3). */
export interface SocketData {
  sessionId: string | null;
}
