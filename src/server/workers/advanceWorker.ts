import { prisma } from '@/lib/prisma';
import { getRedis } from '@/lib/redis';
import { logger } from '@/lib/logger';
import {
  redisKeys,
  ADVANCE_GRACE_MS,
  ADVANCE_TICK_MS,
  ADVANCE_LOCK_TTL_S,
} from '@/shared/constants';
import { advanceIfCurrent } from '@/server/services/queueService';

/**
 * Auto-next authority (PLAYBACK §7.4): polls playing rooms and advances when the
 * current track's known duration has elapsed — robust even if the host's player
 * never reports ENDED (e.g. host disconnected). A Redis `SET NX` lock per
 * (room, item) ensures only one instance advances. The host ENDED report is the
 * low-latency accelerator on top of this.
 */
export function startAdvanceWorker(): () => void {
  const timer = setInterval(() => {
    void tick();
  }, ADVANCE_TICK_MS);
  logger.info('playback advance worker started');
  return () => clearInterval(timer);
}

async function tick(): Promise<void> {
  try {
    const rooms = await prisma.room.findMany({
      where: {
        status: 'active',
        pbStatus: 'playing',
        pbCurrentDurationMs: { gt: 0 },
        NOT: { pbCurrentItemId: null },
      },
      select: {
        id: true,
        pbPositionMs: true,
        pbUpdatedAt: true,
        pbCurrentDurationMs: true,
        pbCurrentItemId: true,
      },
    });

    const now = Date.now();
    for (const r of rooms) {
      if (!r.pbCurrentItemId) continue;
      const elapsed = Number(r.pbPositionMs) + (now - r.pbUpdatedAt.getTime());
      if (elapsed < Number(r.pbCurrentDurationMs) + ADVANCE_GRACE_MS) continue;

      const acquired = await getRedis().set(
        redisKeys.advanceLock(r.id, r.pbCurrentItemId),
        '1',
        'EX',
        ADVANCE_LOCK_TTL_S,
        'NX',
      );
      if (acquired !== 'OK') continue;
      await advanceIfCurrent(r.id, r.pbCurrentItemId);
    }
  } catch (err) {
    logger.error({ err }, 'advance worker tick failed');
  }
}
