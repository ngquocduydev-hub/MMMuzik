import type { Room, Participant } from '@prisma/client';
import { playTrack, goIdle } from '@/shared/domain/playback';
import { isHost } from '@/shared/domain/room';
import { extractYouTubeId } from '@/shared/domain/youtube';
import { AppError, ERRORS } from '@/shared/errors';
import type { QueueItemDto, PlaybackStateDto } from '@/shared/types';
import { logger } from '@/lib/logger';
import * as roomRepo from '@/server/repositories/roomRepository';
import * as queueRepo from '@/server/repositories/queueRepository';
import { resolveYouTube } from '@/server/services/metadataResolver';
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

/** Any participant can add. The first track added to an idle room auto-plays. */
export async function addTrack(
  roomId: string,
  sessionId: string | null,
  urlOrId: string,
): Promise<QueueItemDto> {
  const room = await requireRoom(roomId);
  const participant = await requireParticipant(roomId, sessionId);

  const videoId = extractYouTubeId(urlOrId);
  if (!videoId)
    throw new AppError(ERRORS.QUEUE_INVALID_PROVIDER, 'Enter a valid YouTube URL or id');

  const meta = await resolveYouTube(videoId);
  const track = await queueRepo.upsertTrack({
    provider: 'youtube',
    providerTrackId: videoId,
    title: meta.title,
    thumbnailUrl: meta.thumbnailUrl,
  });
  const item = await queueRepo.addItemAtTail(
    roomId,
    track.id,
    participant.sessionId,
    participant.nickname,
  );

  // Auto-play if nothing is currently playing.
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
 * the next item (playing@0) or drains to idle. Called by the host ENDED report,
 * the server timer, and skip (PLAYBACK §7.4).
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
  // Advance the playback anchor to the next track (or idle), THEN drop the skipped
  // track from the queue so it doesn't linger or reappear on reconnect. Both the
  // anchor (via advance) and the full queue snapshot are broadcast — server-authoritative.
  await advanceIfCurrent(roomId, skippedId);
  await queueRepo.removeItem(roomId, skippedId);
  await broadcastQueue(roomId);
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
