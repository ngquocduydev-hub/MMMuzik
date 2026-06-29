import { getRedis } from '@/lib/redis';
import { logger } from '@/lib/logger';
import {
  redisKeys,
  ROOM_INACTIVE_GRACE_MS,
  ROOM_REAPER_TICK_MS,
  ROOM_REAPER_LOCK_TTL_S,
} from '@/shared/constants';
import { findReapableRoomIds, deleteRooms } from '@/server/repositories/roomRepository';

/**
 * Inactive-room reaper (auto-cleanup job). Periodically hard-deletes rooms that
 * have NO online participants and whose last activity predates the grace window
 * (ROOM_INACTIVE_GRACE_MS). Deletion cascades to participants / queue items /
 * chat messages. A Redis `SET NX` lock ensures only one instance reaps per tick
 * (same cross-instance pattern as the advance worker).
 *
 * "Inactive" is presence-based: join + connect/disconnect bump `lastActivityAt`,
 * so the window measures from the room actually going (and staying) empty.
 */
export function startRoomReaperWorker(): () => void {
  const timer = setInterval(() => {
    void tick();
  }, ROOM_REAPER_TICK_MS);
  logger.info('room reaper worker started');
  return () => clearInterval(timer);
}

async function tick(): Promise<void> {
  try {
    const acquired = await getRedis().set(
      redisKeys.roomReaperLock(),
      '1',
      'EX',
      ROOM_REAPER_LOCK_TTL_S,
      'NX',
    );
    if (acquired !== 'OK') return; // another instance is reaping this tick

    const threshold = new Date(Date.now() - ROOM_INACTIVE_GRACE_MS);
    const ids = await findReapableRoomIds(threshold);
    if (ids.length === 0) return;

    const deleted = await deleteRooms(ids);
    logger.info({ deleted }, 'room reaper removed inactive rooms');
  } catch (err) {
    logger.error({ err }, 'room reaper tick failed');
  }
}
