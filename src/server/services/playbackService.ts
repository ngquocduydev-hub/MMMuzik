import { play, pause, seek } from '@/shared/domain/playback';
import { isHost } from '@/shared/domain/room';
import { AppError, ERRORS } from '@/shared/errors';
import type { PlaybackStateDto } from '@/shared/types';
import { logger } from '@/lib/logger';
import * as roomRepo from '@/server/repositories/roomRepository';
import { getPlaybackCache, setPlaybackCache } from '@/server/cache/playbackCache';
import { toPlaybackStateDto } from '@/server/mappers';

/**
 * Server-authoritative playback. Host requests a command; the server validates
 * authority, applies the deterministic domain transition, persists (Postgres,
 * optimistic-locked), updates Redis, and returns the new state for broadcast.
 */
type Command = { kind: 'play' } | { kind: 'pause' } | { kind: 'seek'; positionMs: number };

const anchorToDto = toPlaybackStateDto;

async function applyCommand(
  roomId: string,
  bySessionId: string | null,
  command: Command,
): Promise<PlaybackStateDto> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const room = await roomRepo.findRoomById(roomId);
    if (!room) throw new AppError(ERRORS.ROOM_NOT_FOUND, 'Room not found');
    if (room.status === 'closed') throw new AppError(ERRORS.ROOM_CLOSED, 'This room has ended');
    if (!isHost(room, bySessionId)) {
      throw new AppError(ERRORS.PLAYBACK_FORBIDDEN, 'Only the host can control playback');
    }

    const current = roomRepo.toAnchor(room);
    const now = Date.now();
    const next =
      command.kind === 'play'
        ? play(current, now)
        : command.kind === 'pause'
          ? pause(current, now)
          : seek(current, command.positionMs, now);

    // Idempotent no-op (e.g. play while already playing): don't write/broadcast.
    if (next === current) return anchorToDto(roomId, current);

    const written = await roomRepo.updatePlaybackAnchor(roomId, room.version, next);
    if (!written) continue; // version conflict → reload + retry

    const dto = anchorToDto(roomId, next);
    await setPlaybackCache(dto);
    logger.info(
      {
        roomId,
        bySessionId,
        command: command.kind,
        status: next.status,
        positionMs: next.positionMs,
        revision: next.revision,
        ts: now,
      },
      `playback:${command.kind}`,
    );
    return dto;
  }
  throw new AppError(ERRORS.PLAYBACK_CONFLICT, 'Playback update conflicted — please retry');
}

export const playbackPlay = (roomId: string, by: string | null) =>
  applyCommand(roomId, by, { kind: 'play' });

export const playbackPause = (roomId: string, by: string | null) =>
  applyCommand(roomId, by, { kind: 'pause' });

export async function playbackSeek(
  roomId: string,
  by: string | null,
  positionMs: number,
): Promise<PlaybackStateDto> {
  // async so validation failures REJECT (rather than throw during arg-eval).
  if (!Number.isInteger(positionMs) || positionMs < 0) {
    throw new AppError(
      ERRORS.PLAYBACK_INVALID_POSITION,
      'positionMs must be a non-negative integer',
    );
  }
  return applyCommand(roomId, by, { kind: 'seek', positionMs });
}

/** Read-through: Redis first, fall back to Postgres and re-warm. */
export async function getPlaybackState(roomId: string): Promise<PlaybackStateDto> {
  const cached = await getPlaybackCache(roomId);
  if (cached) return cached;
  const room = await roomRepo.findRoomById(roomId);
  if (!room) throw new AppError(ERRORS.ROOM_NOT_FOUND, 'Room not found');
  const dto = anchorToDto(roomId, roomRepo.toAnchor(room));
  await setPlaybackCache(dto);
  return dto;
}
