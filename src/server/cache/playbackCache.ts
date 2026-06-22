import { getRedis } from '@/lib/redis';
import { redisKeys } from '@/shared/constants';
import type { PlaybackStateDto } from '@/shared/types';

/**
 * Redis read-through cache for the playback anchor (the realtime source of
 * read truth; Postgres remains persistence — docs/DATABASE.md §9–10).
 */
export async function setPlaybackCache(dto: PlaybackStateDto): Promise<void> {
  await getRedis().set(redisKeys.playback(dto.roomId), JSON.stringify(dto));
}

export async function getPlaybackCache(roomId: string): Promise<PlaybackStateDto | null> {
  const raw = await getRedis().get(redisKeys.playback(roomId));
  return raw ? (JSON.parse(raw) as PlaybackStateDto) : null;
}
