import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { resetDb, resetRedis, teardown, newSession } from './setup';
import { createRoom, joinRoom } from '@/server/services/roomService';
import { addTrack, recoverFromError, getQueue } from '@/server/services/queueService';
import { getPlaybackState } from '@/server/services/playbackService';

const VID1 = 'dQw4w9WgXcQ';
const VID2 = '9bZkp7q19f0';

// No YouTube Data API key here → addTrack uses the oEmbed fallback (stubbed).
beforeEach(async () => {
  await resetDb();
  await resetRedis();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ title: 'Mock', thumbnail_url: 'https://x/t.jpg' }),
    })),
  );
});
afterAll(() => {
  vi.unstubAllGlobals();
});
afterAll(teardown);

async function freshRoom() {
  const host = await newSession('Host');
  const { room } = await createRoom({ name: 'P', nickname: 'DJ', avatar: null }, host.id);
  return { host, room };
}

describe('play-time recovery (recoverFromError)', () => {
  it('host error on the current track auto-advances and removes it', async () => {
    const { host, room } = await freshRoom();
    const a = await addTrack(room.id, host.id, VID1); // current
    const b = await addTrack(room.id, host.id, VID2);

    await recoverFromError(room.id, host.id, a.id);

    const pb = await getPlaybackState(room.id);
    expect(pb.currentTrackId).toBe(b.id); // advanced to next
    const q = await getQueue(room.id);
    expect(q.map((i) => i.id)).toEqual([b.id]); // broken track removed
  });

  it('host error on the only track drains to idle', async () => {
    const { host, room } = await freshRoom();
    const a = await addTrack(room.id, host.id, VID1);
    await recoverFromError(room.id, host.id, a.id);
    expect((await getPlaybackState(room.id)).status).toBe('idle');
    expect(await getQueue(room.id)).toHaveLength(0);
  });

  it('a GUEST error does NOT skip for the room (handled locally)', async () => {
    const { host, room } = await freshRoom();
    const a = await addTrack(room.id, host.id, VID1); // current
    const b = await addTrack(room.id, host.id, VID2);
    const guest = await newSession('Guest');
    await joinRoom({ code: room.code, avatar: null }, guest);

    await recoverFromError(room.id, guest.id, a.id);

    expect((await getPlaybackState(room.id)).currentTrackId).toBe(a.id); // unchanged
    expect((await getQueue(room.id)).map((i) => i.id)).toEqual([a.id, b.id]);
  });

  it('is idempotent for a stale (non-current) item id', async () => {
    const { host, room } = await freshRoom();
    const a = await addTrack(room.id, host.id, VID1);
    await recoverFromError(room.id, host.id, 'not-the-current-id');
    expect((await getPlaybackState(room.id)).currentTrackId).toBe(a.id); // unchanged
  });
});
