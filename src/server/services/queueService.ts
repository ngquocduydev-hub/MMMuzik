import type { Room, Participant } from '@prisma/client';
import { playTrack, goIdle } from '@/shared/domain/playback';
import { isHost } from '@/shared/domain/room';
import { extractYouTubeId } from '@/shared/domain/youtube';
import { AppError, ERRORS } from '@/shared/errors';
import type { QueueItemDto, PlaybackStateDto } from '@/shared/types';
import { logger } from '@/lib/logger';
import {
  QUEUE_MAX_SIZE,
  QUEUE_MAX_PENDING_PER_USER,
  QUEUE_ADD_BURST_LIMIT,
  QUEUE_ADD_BURST_WINDOW_MS,
  QUEUE_ADD_SUSTAINED_LIMIT,
  QUEUE_ADD_SUSTAINED_WINDOW_MS,
} from '@/shared/constants';
import * as roomRepo from '@/server/repositories/roomRepository';
import * as queueRepo from '@/server/repositories/queueRepository';
import { resolveYouTube } from '@/server/services/metadataResolver';
import { fetchVideoDetails } from '@/server/services/youtubeDataApi';
import { consumeRateLimit } from '@/server/services/rateLimiter';
import { getQueueCache, setQueueCache } from '@/server/cache/queueCache';
import { setPlaybackCache } from '@/server/cache/playbackCache';
import { toQueueItemDto, toPlaybackStateDto } from '@/server/mappers';
import { emitToRoom } from '@/server/realtime/emitter';

/**
 * Server-authoritative queue. Clients request actions; the server mutates the
 * ordered list, drives auto-play/auto-next on the playback anchor, persists,
 * and broadcasts (via the Redis emitter so it works from sockets AND the worker).
 * The queue:updated broadcast is a FULL snapshot — clients never merge.
 */

async function requireRoom(roomId: string): Promise<Room> {
  const room = await roomRepo.findRoomById(roomId);
  if (!room) throw new AppError(ERRORS.ROOM_NOT_FOUND, 'Room not found');
  if (room.status === 'closed') throw new AppError(ERRORS.ROOM_CLOSED, 'This room has ended');
  return room;
}

function requireHost(room: Room, sessionId: string | null): void {
  if (!isHost(room, sessionId)) {
    throw new AppError(ERRORS.QUEUE_FORBIDDEN, 'Only the host can do that');
  }
}

/** Any current member of the room (host or guest). Identity is the handshake-bound
 *  session — never a payload. Used by collaborative actions (add, skip). */
async function requireParticipant(roomId: string, sessionId: string | null): Promise<Participant> {
  if (!sessionId) throw new AppError(ERRORS.SESSION_REQUIRED, 'No active session');
  const participant = await roomRepo.findParticipant(roomId, sessionId);
  if (!participant) throw new AppError(ERRORS.SESSION_REQUIRED, 'Join the room first');
  return participant;
}

async function broadcastQueue(roomId: string): Promise<QueueItemDto[]> {
  const items = (await queueRepo.listItems(roomId)).map(toQueueItemDto);
  await setQueueCache(roomId, items);
  emitToRoom(roomId, 'queue:updated', { roomId, queue: items });
  return items;
}

async function broadcastPlayback(dto: PlaybackStateDto): Promise<void> {
  await setPlaybackCache(dto);
  emitToRoom(dto.roomId, 'playback:stateChanged', dto);
}

/** Make a queue item the current track (auto-play first / skip / advance). */
async function playItem(
  roomId: string,
  item: { id: string; videoId: string; durationMs: number },
): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const room = await roomRepo.findRoomById(roomId);
    if (!room || room.status === 'closed') return false;
    const next = playTrack(
      roomRepo.toAnchor(room),
      { itemId: item.id, videoId: item.videoId },
      Date.now(),
    );
    const written = await roomRepo.updatePlaybackAnchor(
      roomId,
      room.version,
      next,
      item.durationMs,
    );
    if (!written) continue;
    await broadcastPlayback(toPlaybackStateDto(roomId, next));
    return true;
  }
  return false;
}

export async function getQueue(roomId: string): Promise<QueueItemDto[]> {
  const cached = await getQueueCache(roomId);
  if (cached) return cached;
  const items = (await queueRepo.listItems(roomId)).map(toQueueItemDto);
  await setQueueCache(roomId, items);
  return items;
}

/** Position of the current track (idle → -1) for upcoming-aware queue checks. */
async function currentPosition(room: Room): Promise<number> {
  if (!room.pbCurrentItemId) return -1;
  const cur = await queueRepo.findItem(room.id, room.pbCurrentItemId);
  return cur?.position ?? -1;
}

/**
 * Per-(room, session) add rate limit — burst + sustained windows. Runs BEFORE any
 * YouTube Data API spend so a flooder can't drain the shared quota. Throws
 * QUEUE_RATE_LIMITED carrying retryAfterMs (surfaced on the ack envelope).
 */
async function enforceAddRateLimit(roomId: string, sessionId: string): Promise<void> {
  const id = `${roomId}:${sessionId}`;
  const burst = await consumeRateLimit(
    'queue-add:burst',
    id,
    QUEUE_ADD_BURST_LIMIT,
    QUEUE_ADD_BURST_WINDOW_MS,
  );
  if (!burst.allowed) {
    throw new AppError(
      ERRORS.QUEUE_RATE_LIMITED,
      "You're adding songs too fast — give it a moment",
      burst.retryAfterMs,
    );
  }
  const sustained = await consumeRateLimit(
    'queue-add:sustained',
    id,
    QUEUE_ADD_SUSTAINED_LIMIT,
    QUEUE_ADD_SUSTAINED_WINDOW_MS,
  );
  if (!sustained.allowed) {
    throw new AppError(
      ERRORS.QUEUE_RATE_LIMITED,
      "You've added a lot recently — take a short break",
      sustained.retryAfterMs,
    );
  }
}

/**
 * Resolve metadata AND enforce add-time availability guards. With the Data API
 * configured: rejects unavailable / livestream / un-embeddable videos BEFORE they
 * can enter the shared queue, and returns the authoritative duration. Without a
 * key: falls back to keyless oEmbed (no availability guards, duration unknown) —
 * preserving prior behavior (docs/features/youtube-in-app-search Phase 1).
 */
async function resolveAndGuard(
  videoId: string,
): Promise<{ title: string; thumbnailUrl: string | null; durationMs: number }> {
  const details = await fetchVideoDetails(videoId);
  if (!details) {
    const meta = await resolveYouTube(videoId);
    return { title: meta.title, thumbnailUrl: meta.thumbnailUrl, durationMs: 0 };
  }
  if (!details.exists) {
    throw new AppError(ERRORS.QUEUE_UNPLAYABLE, "That video isn't available");
  }
  if (details.isLivestream) {
    throw new AppError(ERRORS.QUEUE_LIVESTREAM, "Live streams aren't supported yet");
  }
  if (!details.embeddable) {
    throw new AppError(
      ERRORS.QUEUE_UNPLAYABLE,
      "That video can't be played in MMMuzik — try opening it on YouTube",
    );
  }
  return {
    title: details.title,
    thumbnailUrl: details.thumbnailUrl,
    durationMs: details.durationMs,
  };
}

/**
 * Any participant can add. The first track added to an idle room auto-plays.
 *
 * Protection layer (docs/features/youtube-in-app-search Phase 1), enforced
 * server-side in order — cheap checks before any Data API spend, and ALL guards
 * before the auto-play branch so a bad first track can never strand the room:
 *   1. rate limit (burst + sustained)   2. per-user pending cap + per-room ceiling
 *   3. duplicate (warn-not-block)        4. availability guards + authoritative duration
 */
export async function addTrack(
  roomId: string,
  sessionId: string | null,
  urlOrId: string,
  allowDuplicate = false,
): Promise<QueueItemDto> {
  const room = await requireRoom(roomId);
  const participant = await requireParticipant(roomId, sessionId);

  await enforceAddRateLimit(roomId, participant.sessionId);

  const videoId = extractYouTubeId(urlOrId);
  if (!videoId)
    throw new AppError(ERRORS.QUEUE_INVALID_PROVIDER, 'Enter a valid YouTube URL or id');

  const curPos = await currentPosition(room);

  // Caps — cheap; reject before spending Data API quota.
  const pendingByUser = await queueRepo.countUpcomingBySession(
    roomId,
    participant.sessionId,
    curPos,
  );
  if (pendingByUser >= QUEUE_MAX_PENDING_PER_USER) {
    throw new AppError(
      ERRORS.QUEUE_USER_LIMIT,
      `You can have up to ${QUEUE_MAX_PENDING_PER_USER} songs up next — wait for some to play`,
    );
  }
  if ((await queueRepo.count(roomId)) >= QUEUE_MAX_SIZE) {
    throw new AppError(ERRORS.QUEUE_FULL, 'The queue is full right now — try again shortly');
  }

  // Duplicate — warn-not-block: same video current or upcoming. Client confirms,
  // then re-sends with allowDuplicate=true for a deliberate replay.
  if (!allowDuplicate) {
    const dup = await queueRepo.findActiveByVideoId(
      roomId,
      'youtube',
      videoId,
      Math.max(curPos, 0),
    );
    if (dup) {
      const where = dup.id === room.pbCurrentItemId ? 'playing right now' : 'already up next';
      throw new AppError(
        ERRORS.QUEUE_DUPLICATE,
        `"${dup.track.title}" is ${where} (added by ${dup.addedByNickname}) — add it again?`,
      );
    }
  }

  const meta = await resolveAndGuard(videoId);
  const track = await queueRepo.upsertTrack({
    provider: 'youtube',
    providerTrackId: videoId,
    title: meta.title,
    thumbnailUrl: meta.thumbnailUrl,
    durationMs: meta.durationMs,
  });
  const item = await queueRepo.addItemAtTail(
    roomId,
    track.id,
    participant.sessionId,
    participant.nickname,
  );

  // Auto-play if nothing is currently playing. Guards above already ran, so the
  // first track can never be a livestream/unplayable item.
  if (room.pbCurrentItemId === null && room.pbStatus === 'idle') {
    await playItem(roomId, { id: item.id, videoId, durationMs: Number(track.durationMs) });
  }

  await broadcastQueue(roomId);
  logger.info({ roomId, sessionId, videoId, itemId: item.id }, 'queue:add');
  return toQueueItemDto({ ...item, track });
}

export async function removeTrack(
  roomId: string,
  sessionId: string | null,
  itemId: string,
): Promise<void> {
  const room = await requireRoom(roomId);
  requireHost(room, sessionId);
  if (room.pbCurrentItemId === itemId) {
    throw new AppError(
      ERRORS.QUEUE_CANNOT_REMOVE_CURRENT,
      "Can't remove the playing track — skip it",
    );
  }
  const item = await queueRepo.findItem(roomId, itemId);
  if (!item) throw new AppError(ERRORS.QUEUE_ITEM_NOT_FOUND, 'Queue item not found');
  await queueRepo.removeItem(roomId, itemId);
  await broadcastQueue(roomId);
}

export async function reorderQueue(
  roomId: string,
  sessionId: string | null,
  orderedIds: string[],
): Promise<void> {
  const room = await requireRoom(roomId);
  requireHost(room, sessionId);
  const current = await queueRepo.listItems(roomId);
  const currentIds = new Set(current.map((i) => i.id));
  const sameSize = orderedIds.length === currentIds.size;
  const sameSet = orderedIds.every((id) => currentIds.has(id));
  if (!sameSize || !sameSet || new Set(orderedIds).size !== orderedIds.length) {
    throw new AppError(ERRORS.QUEUE_INVALID_REORDER, 'Reorder must list every item exactly once');
  }
  await queueRepo.reorder(roomId, orderedIds);
  await broadcastQueue(roomId);
}

export async function clearQueue(roomId: string, sessionId: string | null): Promise<void> {
  const room = await requireRoom(roomId);
  requireHost(room, sessionId);
  await queueRepo.clear(roomId);
  if (room.pbStatus !== 'idle' || room.pbCurrentItemId !== null) {
    const idle = goIdle(roomRepo.toAnchor(room), Date.now());
    await roomRepo.updatePlaybackAnchor(roomId, room.version, idle, 0);
    await broadcastPlayback(toPlaybackStateDto(roomId, idle));
  }
  await broadcastQueue(roomId);
}

/**
 * Idempotent advance — no-op unless `endedItemId` is still current. Advances to
 * the next item (playing@0) or drains to idle, AND removes the finished track from
 * the queue (the queue holds only the current + upcoming tracks — no history).
 * Called by the host ENDED report, the server timer, skip, and play-time recovery
 * (PLAYBACK §7.4).
 */
export async function advanceIfCurrent(roomId: string, endedItemId: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const room = await roomRepo.findRoomById(roomId);
    if (!room || room.status === 'closed') return;
    if (room.pbCurrentItemId !== endedItemId) return; // already advanced — idempotent

    const next = await queueRepo.nextItemAfter(roomId, endedItemId);
    const now = Date.now();
    if (next) {
      const anchor = playTrack(
        roomRepo.toAnchor(room),
        { itemId: next.id, videoId: next.track.providerTrackId },
        now,
      );
      if (
        !(await roomRepo.updatePlaybackAnchor(
          roomId,
          room.version,
          anchor,
          Number(next.track.durationMs),
        ))
      ) {
        continue;
      }
      await broadcastPlayback(toPlaybackStateDto(roomId, anchor));
      emitToRoom(roomId, 'playback:nextTrack', { roomId, item: toQueueItemDto(next) });
    } else {
      const anchor = goIdle(roomRepo.toAnchor(room), now);
      if (!(await roomRepo.updatePlaybackAnchor(roomId, room.version, anchor, 0))) continue;
      await broadcastPlayback(toPlaybackStateDto(roomId, anchor));
    }
    // The finished track leaves the queue (no history kept) — clients get the
    // updated full snapshot. removeItem is idempotent if it's already gone.
    await queueRepo.removeItem(roomId, endedItemId);
    await broadcastQueue(roomId);
    logger.info({ roomId, endedItemId, advancedTo: next?.id ?? null }, 'playback:advance');
    return;
  }
}

export async function skip(roomId: string, sessionId: string | null): Promise<void> {
  const room = await requireRoom(roomId);
  // Any participant may skip (collaborative "aux cord") — was host-only. Still
  // server-authoritative: the server performs the advance + removal atomically and
  // broadcasts the new anchor + full queue snapshot; clients only request it.
  await requireParticipant(roomId, sessionId);
  const skippedId = room.pbCurrentItemId;
  if (!skippedId) return;
  // advanceIfCurrent moves the anchor to the next track (or idle), removes the
  // skipped track, and broadcasts the new anchor + full queue snapshot.
  await advanceIfCurrent(roomId, skippedId);
}

/**
 * Play-time recovery (docs/features/youtube-in-app-search Phase 1). The HOST's
 * player reported the current track is unplayable (removed / embedding-disabled /
 * region-blocked for the host). Advance past it AND remove it so the room is never
 * stranded on dead air. Idempotent (no-op unless the errored item is still current)
 * and HOST-only — a guest's local failure must never skip for everyone (the guest
 * just gets the local "Open on YouTube" hatch on their own screen).
 */
export async function recoverFromError(
  roomId: string,
  sessionId: string | null,
  erroredItemId: string,
): Promise<void> {
  const room = await requireRoom(roomId);
  if (!isHost(room, sessionId)) return; // guests handle errors locally
  if (room.pbCurrentItemId !== erroredItemId) return; // idempotent — already moved on
  // advanceIfCurrent advances past the bad track, removes it, and broadcasts.
  await advanceIfCurrent(roomId, erroredItemId);
  logger.info({ roomId, erroredItemId }, 'playback:recoverFromError');
}

/** Host player ENDED accelerator — only the host's ended event drives advance. */
export async function advanceOnEnded(
  roomId: string,
  sessionId: string | null,
  endedItemId: string,
): Promise<void> {
  const room = await requireRoom(roomId);
  if (!isHost(room, sessionId)) return; // non-host ENDED ignored; the timer backstops
  await advanceIfCurrent(roomId, endedItemId);
}

/** Host player reports the real track duration (corrects the 0 placeholder). */
export async function reportDuration(
  roomId: string,
  sessionId: string | null,
  queueItemId: string,
  durationMs: number,
): Promise<void> {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return;
  const room = await requireRoom(roomId);
  requireHost(room, sessionId);
  const item = await queueRepo.findItem(roomId, queueItemId);
  if (!item) return;
  await queueRepo.updateTrackDuration(item.trackId, durationMs);
  if (room.pbCurrentItemId === queueItemId) {
    await roomRepo.setCurrentDuration(roomId, durationMs);
  }
  await broadcastQueue(roomId);
}
