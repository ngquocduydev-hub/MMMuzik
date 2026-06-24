import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { resetDb, resetRedis, teardown, newSession, expectAppError } from './setup';
import { createRoom } from '@/server/services/roomService';
import { searchTracks } from '@/server/services/searchService';
import { getRedis } from '@/lib/redis';
import { redisKeys, SEARCH_DAILY_QUOTA_BUDGET } from '@/shared/constants';
import { ERRORS } from '@/shared/errors';

const NORMAL = 'aaaaaaaaaaa';
const LIVE = 'bbbbbbbbbbb';

function searchListBody() {
  return { items: [{ id: { videoId: NORMAL } }, { id: { videoId: LIVE } }] };
}
function videosListBody() {
  return {
    items: [
      {
        id: NORMAL,
        snippet: { title: 'Normal', channelTitle: 'Artist', liveBroadcastContent: 'none' },
        contentDetails: { duration: 'PT3M33S' },
        status: { embeddable: true, privacyStatus: 'public' },
        statistics: { viewCount: '1000' },
      },
      {
        id: LIVE,
        snippet: { title: 'Live', channelTitle: 'Beats', liveBroadcastContent: 'live' },
        contentDetails: { duration: 'P0D' },
        status: { embeddable: true, privacyStatus: 'public' },
      },
    ],
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  await resetDb();
  await resetRedis();
  process.env.YOUTUBE_API_KEY = 'test-key';
  fetchMock = vi.fn(async (url: string) => {
    const u = String(url);
    const body = u.includes('/youtube/v3/search') ? searchListBody() : videosListBody();
    return { ok: true, json: async () => body } as unknown as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
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

describe('searchTracks', () => {
  it('returns enriched, order-preserved results with addable flags', async () => {
    const { host, room } = await freshRoom();
    const res = await searchTracks(room.id, host.id, 'lofi');
    expect(res.available).toBe(true);
    expect(res.results.map((r) => r.videoId)).toEqual([NORMAL, LIVE]); // search order kept
    const [normal, live] = res.results;
    expect(normal).toMatchObject({ durationMs: 213_000, viewCount: 1000, addable: true });
    expect(live).toMatchObject({ isLivestream: true, addable: false }); // livestream not addable
  });

  it('serves a repeated query from cache (no extra API calls)', async () => {
    const { host, room } = await freshRoom();
    await searchTracks(room.id, host.id, 'lofi');
    const callsAfterFirst = fetchMock.mock.calls.length; // 2: search.list + videos.list
    await searchTracks(room.id, host.id, 'LoFi'); // normalizes to same key
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst); // 0 new calls
  });

  it('rejects a non-participant (identity is the session, not a payload)', async () => {
    const { room } = await freshRoom();
    const outsider = await newSession('Outsider'); // never joined
    await expectAppError(searchTracks(room.id, outsider.id, 'lofi'), ERRORS.SESSION_REQUIRED.code);
  });

  it('degrades (available:false) when no API key is configured', async () => {
    const { host, room } = await freshRoom();
    delete process.env.YOUTUBE_API_KEY;
    const res = await searchTracks(room.id, host.id, 'lofi');
    expect(res).toEqual({ available: false, results: [] });
  });

  it('degrades (available:false) when the daily quota budget is spent', async () => {
    const { host, room } = await freshRoom();
    const day = new Date().toISOString().slice(0, 10);
    await getRedis().set(redisKeys.searchQuotaDay(day), String(SEARCH_DAILY_QUOTA_BUDGET));
    const res = await searchTracks(room.id, host.id, 'fresh-query');
    expect(res.available).toBe(false);
  });

  it('degrades (available:false) when the Data API call fails', async () => {
    const { host, room } = await freshRoom();
    fetchMock.mockImplementation(
      async () => ({ ok: false, status: 503, json: async () => ({}) }) as unknown as Response,
    );
    const res = await searchTracks(room.id, host.id, 'will-fail');
    expect(res).toEqual({ available: false, results: [] });
  });

  it('rate-limits a burst of searches', async () => {
    const { host, room } = await freshRoom();
    for (let i = 0; i < 10; i++) await searchTracks(room.id, host.id, 'lofi'); // 10 = limit
    await expectAppError(searchTracks(room.id, host.id, 'lofi'), ERRORS.RATE_LIMITED.code);
  });
});
