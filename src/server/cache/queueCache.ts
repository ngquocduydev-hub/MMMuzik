import { getRedis } from '@/lib/redis';
import { redisKeys } from '@/shared/constants';
import type { QueueItemDto } from '@/shared/types';

/** Read-through Redis cache of the ordered queue (realtime read source). */
export async function setQueueCache(roomId: string, items: QueueItemDto[]): Promise<void> {
  await getRedis().set(redisKeys.queue(roomId), JSON.stringify(items));
}

export async function getQueueCache(roomId: string): Promise<QueueItemDto[] | null> {
  const raw = await getRedis().get(redisKeys.queue(roomId));
  return raw ? (JSON.parse(raw) as QueueItemDto[]) : null;
}
