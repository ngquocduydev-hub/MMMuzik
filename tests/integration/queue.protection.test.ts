import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { resetDb, resetRedis, teardown, newSession, expectAppError } from './setup';
import { createRoom } from '@/server/services/roomService';
import { addTrack, getQueue } from '@/server/services/queueService';
import { getPlaybackState } from '@/server/services/playbackService';
import { consumeRateLimit } from '@/server/services/rateLimiter';
import * as queueRepo from '@/server/repositories/queueRepository';
import { AppError, isAppError, ERRORS } from '@/shared/errors';
import { QUEUE_MAX_PENDING_PER_USER } from '@/shared/constants';
import { prisma } from '@/lib/prisma';

/**
 * Phase 1 Protection Layer — docs/features/youtube-in-app-search/IMPLEMENTATION_PLAN.md.
 * These tests run WITH a (stubbed) YouTube Data API key so the add-time guards are
 * active. The fetch stub returns a videos.list shape keyed by the requested id.
 */

const NORMAL = 'dQw4w9WgXcQ'; // embeddable VOD, PT3M33S
const LIVE = '9bZkp7q19f0'; // livestream
const NOEMBED = 'kJQP7kiw5Fk'; // embedding disabled
const MISSING = 'AAAAAAAAAAA'; // videos.list returns no item

function dataApiItem(videoId: string): { items: unknown[] } {
  if (videoId === LIVE)
    return {
      items: [
        {
          snippet: { title: 'Lo-fi radio', liveBroadcastContent: 'live' },
          contentDetails: { duration: 'P0D' },
          status: { embeddable: true, privacyStatus: 'public' },
        },
      ],
    };
  if (videoId === NOEMBED)
    return {
      items: [
        {
          snippet: { title: 'No Embed', liveBroadcastContent: 'none' },
          contentDetails: { duration: 'PT3M' },
          status: { embeddable: false, privacyStatus: 'public' },
        },
      ],
    };
  if (videoId === MISSING) return { items: [] };
  return {
    items: [
      {
        snippet: {
          title: 'Normal Song',
          liveBroadcastContent: 'none',
          thumbnails: { medium: { url: 'https://x/t.jpg' } },
        },
        contentDetails: { duration: 'PT3M33S' },
        status: { embeddable: true, privacyStatus: 'public' },
      },
    ],
  };
}

beforeEach(async () => {
  await resetDb();
  await resetRedis();
  process.env.YOUTUBE_API_KEY = 'test-key';
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const id = new URL(String(url)).searchParams.get('id') ?? '';
      return { ok: true, json: async () => dataApiItem(id) } as unknown as Response;
    }),
  );
});
afterEach(() => {
  delete process.env.YOUTUBE_API_KEY;
  vi.unstubAllGlobals();
});
afterAll(teardown);

async function freshRoom() {
  const host = await newSession('Host');
  const { room } = await createRoom({ name: 'P', nickname: 'DJ', avatar: null }, host.id);
  return { host, room };
}

describe('add-time availability guards (Data API configured)', () => {
  it('captures authoritative duration at add — no host reportDuration needed', async () => {
    const { host, room } = await freshRoom();
    const item = await addTrack(room.id, host.id, NORMAL);
    expect(item.durationMs).toBe(213_000);
    const r = await prisma.room.findUnique({ where: { id: room.id } });
    expect(Number(r?.pbCurrentDurationMs)).toBe(213_000); // auto-play set the real duration
  });

  it('rejects a livestream before it can enter the queue or auto-play', async () => {
    const { host, room } = await freshRoom();
    await expectAppError(addTrack(room.id, host.id, LIVE), ERRORS.QUEUE_LIVESTREAM.code);
    expect(await getQueue(room.id)).toHaveLength(0);
    expect((await getPlaybackState(room.id)).status).toBe('idle');
  });

  it('rejects an un-embeddable video', async () => {
    const { host, room } = await freshRoom();
    await expectAppError(addTrack(room.id, host.id, NOEMBED), ERRORS.QUEUE_UNPLAYABLE.code);
    expect(await getQueue(room.id)).toHaveLength(0);
  });

  it('rejects an unavailable (deleted/private) video', async () => {
    const { host, room } = await freshRoom();
    await expectAppError(addTrack(room.id, host.id, MISSING), ERRORS.QUEUE_UNPLAYABLE.code);
  });
});

describe('duplicate handling (warn-not-block)', () => {
  it('blocks a duplicate of the current/upcoming track, allows it with allowDuplicate', async () => {
    const { host, room } = await freshRoom();
    await addTrack(room.id, host.id, NORMAL); // becomes current (pos 0)
    await expectAppError(addTrack(room.id, host.id, NORMAL), ERRORS.QUEUE_DUPLICATE.code);
    const again = await addTrack(room.id, host.id, NORMAL, true); // deliberate replay
    expect(again.position).toBe(1);
    expect(await getQueue(room.id)).toHaveLength(2);
  });
});

describe('queue protection — per-user pending cap', () => {
  it(`rejects once the user has ${QUEUE_MAX_PENDING_PER_USER} songs up next`, async () => {
    const { host, room } = await freshRoom();
    // Seed the cap directly (bypasses the add rate limit, which would otherwise
    // throttle reaching the cap). Room stays idle, so all seeded items are "upcoming".
    for (let i = 0; i < QUEUE_MAX_PENDING_PER_USER; i++) {
      const t = await queueRepo.upsertTrack({
        provider: 'youtube',
        providerTrackId: `seedvideo${String(i).padStart(2, '0')}`,
        title: `seed ${i}`,
        thumbnailUrl: null,
      });
      await queueRepo.addItemAtTail(room.id, t.id, host.id, 'DJ');
    }
    await expectAppError(addTrack(room.id, host.id, NORMAL), ERRORS.QUEUE_USER_LIMIT.code);
  });
});

describe('add rate limiting', () => {
  it('throttles a burst of adds and reports retryAfterMs', async () => {
    const { host, room } = await freshRoom();
    const ids = ['rate0000001', 'rate0000002', 'rate0000003', 'rate0000004', 'rate0000005'];
    for (const id of ids) await addTrack(room.id, host.id, id); // 5 adds = burst limit
    let thrown: unknown;
    try {
      await addTrack(room.id, host.id, 'rate0000006'); // 6th trips the burst window
    } catch (e) {
      thrown = e;
    }
    expect(isAppError(thrown)).toBe(true);
    expect((thrown as AppError).code).toBe(ERRORS.QUEUE_RATE_LIMITED.code);
    expect((thrown as AppError).retryAfterMs ?? 0).toBeGreaterThan(0);
  });
});

describe('rate limiter primitive', () => {
  it('allows up to the limit, then denies with a retry hint', async () => {
    for (let i = 0; i < 3; i++) {
      const r = await consumeRateLimit('test-scope', 'k1', 3, 10_000);
      expect(r.allowed).toBe(true);
    }
    const denied = await consumeRateLimit('test-scope', 'k1', 3, 10_000);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterMs).toBeGreaterThan(0);
  });

  it('scopes counters independently by key', async () => {
    await consumeRateLimit('s', 'a', 1, 10_000);
    const other = await consumeRateLimit('s', 'b', 1, 10_000);
    expect(other.allowed).toBe(true);
  });
});
