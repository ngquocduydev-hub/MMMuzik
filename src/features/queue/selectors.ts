import type { QueueItemDto } from '@/shared/types';
import { useQueueStore } from './store';
import { usePlaybackStore } from '@/features/playback/store';

/**
 * Single source of truth for the **Up Next** count: the number of queued videos
 * strictly AFTER the currently-playing one, by queue `position`.
 *
 * Counting "items that aren't the current one" is wrong — completed tracks linger
 * in the queue (auto-advance keeps them), so they sit BEFORE the current item and
 * must not be counted. Counting by position excludes the current track, any
 * completed tracks before it, and resolves to 0 when nothing is playing.
 *
 *   [A▶]            → 0
 *   [A▶, B]         → 1
 *   [A▶, B, C]      → 2
 *   [done, A▶, B]   → 1   (the completed track is not counted)
 */
export function upNextCount(items: QueueItemDto[], currentTrackId: string | null): number {
  if (!currentTrackId) return 0; // nothing playing → nothing "after the current"
  const current = items.find((i) => i.id === currentTrackId);
  if (!current) return 0; // current not in the queue (transient) → safe default
  return items.reduce((n, i) => (i.position > current.position ? n + 1 : n), 0);
}

/** React hook wiring the selector to the queue + playback stores. */
export function useUpNextCount(): number {
  const items = useQueueStore((s) => s.items);
  const currentTrackId = usePlaybackStore((s) => s.playback?.currentTrackId ?? null);
  return upNextCount(items, currentTrackId);
}
