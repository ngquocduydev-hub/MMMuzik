import { describe, it, expect } from 'vitest';
import { upNextCount } from '@/features/queue/selectors';
import type { QueueItemDto } from '@/shared/types';

const item = (id: string, position: number): QueueItemDto => ({
  id,
  roomId: 'r1',
  trackId: `t-${id}`,
  provider: 'youtube',
  videoId: 'dQw4w9WgXcQ',
  title: id,
  durationMs: 0,
  thumbnailUrl: null,
  position,
  addedBySessionId: 's',
  addedByNickname: 'n',
  addedAt: '2026-01-01T00:00:00.000Z',
});

describe('upNextCount (single source of truth)', () => {
  it('counts only videos AFTER the currently-playing one (by position)', () => {
    expect(upNextCount([item('A', 0)], 'A')).toBe(0); // [A▶]
    expect(upNextCount([item('A', 0), item('B', 1)], 'A')).toBe(1); // [A▶, B]
    expect(upNextCount([item('A', 0), item('B', 1), item('C', 2)], 'A')).toBe(2); // [A▶, B, C]
    expect(upNextCount([item('A', 0), item('B', 1), item('C', 2), item('D', 3)], 'A')).toBe(3); // [A▶, B, C, D]
  });

  it('does NOT count completed tracks lingering before the current', () => {
    // [done, B▶, C] → only C is up next
    expect(upNextCount([item('done', 0), item('B', 1), item('C', 2)], 'B')).toBe(1);
  });

  it('counts by position regardless of array order', () => {
    const unsorted = [item('C', 2), item('A', 0), item('B', 1)];
    expect(upNextCount(unsorted, 'A')).toBe(2);
  });

  it('returns 0 when nothing is playing or the queue is empty', () => {
    expect(upNextCount([item('A', 0)], null)).toBe(0);
    expect(upNextCount([], null)).toBe(0);
  });

  it('returns 0 when the current id is not in the queue (transient)', () => {
    expect(upNextCount([item('A', 0), item('B', 1)], 'missing')).toBe(0);
  });
});
