import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { resetDb, resetRedis, teardown, newSession, expectAppError } from './setup';
import { createRoom, joinRoom } from '@/server/services/roomService';
import {
  addTrack,
  removeTrack,
  reorderQueue,
  clearQueue,
  skip,
  advanceIfCurrent,
  reportDuration,
  getQueue,
} from '@/server/services/queueService';
import { getPlaybackState } from '@/server/services/playbackService';
import { ERRORS } from '@/shared/errors';
import { prisma } from '@/lib/prisma';

const VID1 = 'dQw4w9WgXcQ';
const VID2 = '9bZkp7q19f0';
const VID3 = 'kJQP7kiw5Fk';

// Mock YouTube oEmbed so addTrack never hits the network.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ title: 'Mock Title', thumbnail_url: 'https://x/t.jpg' }),
    })),
  );
});
afterAll(() => {
  vi.unstubAllGlobals();
});

async function freshRoom() {
  const host = await newSession('Host');
  const { room } = await createRoom({ name: 'P', nickname: 'DJ', avatar: null }, host.id);
  return { host, room };
}

beforeEach(async () => {
  await resetDb();
  await resetRedis();
});
afterAll(teardown);

describe('addTrack', () => {
  it('first track auto-plays; metadata resolved; appears in queue', async () => {
    const { host, room } = await freshRoom();
    const item = await addTrack(room.id, host.id, `https://youtu.be/${VID1}`);
    expect(item.videoId).toBe(VID1);
    expect(item.title).toBe('Mock Title');
    expect(item.position).toBe(0);

    const pb = await getPlaybackState(room.id);
    expect(pb.status).toBe('playing');
    expect(pb.currentVideoId).toBe(VID1);
    expect(pb.currentTrackId).toBe(item.id);

    expect(await getQueue(room.id)).toHaveLength(1);
  });

  it('second track is appended; playback unchanged', async () => {
    const { host, room } = await freshRoom();
    const first = await addTrack(room.id, host.id, VID1);
    const second = await addTrack(room.id, host.id, VID2);
    expect(second.position).toBe(1);
    const pb = await getPlaybackState(room.id);
    expect(pb.currentTrackId).toBe(first.id); // still the first
  });

  it('any participant (non-host) can add', async () => {
    const { room } = await freshRoom();
    const guest = await newSession('Guest');
    await joinRoom({ code: room.code, avatar: null }, guest);
    const item = await addTrack(room.id, guest.id, VID1);
    expect(item.addedByNickname).toBe('Guest');
  });

  it('rejects an invalid url', async () => {
    const { host, room } = await freshRoom();
    await expectAppError(
      addTrack(room.id, host.id, 'not a video'),
      ERRORS.QUEUE_INVALID_PROVIDER.code,
    );
  });
});

describe('removeTrack', () => {
  it('blocks removing the currently-playing track (skip instead)', async () => {
    const { host, room } = await freshRoom();
    const current = await addTrack(room.id, host.id, VID1);
    await expectAppError(
      removeTrack(room.id, host.id, current.id),
      ERRORS.QUEUE_CANNOT_REMOVE_CURRENT.code,
    );
  });

  it('removes a non-current track and recompacts', async () => {
    const { host, room } = await freshRoom();
    await addTrack(room.id, host.id, VID1); // current
    const second = await addTrack(room.id, host.id, VID2);
    await removeTrack(room.id, host.id, second.id);
    expect(await getQueue(room.id)).toHaveLength(1);
  });

  it('non-host cannot remove', async () => {
    const { host, room } = await freshRoom();
    await addTrack(room.id, host.id, VID1);
    const second = await addTrack(room.id, host.id, VID2);
    const guest = await newSession('Guest');
    await joinRoom({ code: room.code, avatar: null }, guest);
    await expectAppError(removeTrack(room.id, guest.id, second.id), ERRORS.QUEUE_FORBIDDEN.code);
  });
});

describe('reorderQueue', () => {
  it('reorders to the given order', async () => {
    const { host, room } = await freshRoom();
    const a = await addTrack(room.id, host.id, VID1);
    const b = await addTrack(room.id, host.id, VID2);
    await reorderQueue(room.id, host.id, [b.id, a.id]);
    const q = await getQueue(room.id);
    expect(q.map((i) => i.id)).toEqual([b.id, a.id]);
    expect(q[0]!.position).toBe(0);
  });

  it('rejects an incomplete set', async () => {
    const { host, room } = await freshRoom();
    const a = await addTrack(room.id, host.id, VID1);
    await addTrack(room.id, host.id, VID2);
    await expectAppError(reorderQueue(room.id, host.id, [a.id]), ERRORS.QUEUE_INVALID_REORDER.code);
  });
});

describe('auto-next (skip / advance / idle)', () => {
  it('skip REMOVES the current track, advances to the next, then drains to idle', async () => {
    const { host, room } = await freshRoom();
    const a = await addTrack(room.id, host.id, VID1); // current
    const b = await addTrack(room.id, host.id, VID2);

    await skip(room.id, host.id);
    let pb = await getPlaybackState(room.id);
    expect(pb.currentTrackId).toBe(b.id);
    expect(pb.status).toBe('playing');
    // Issue 3: the skipped track is removed from the queue (not left behind).
    let q = await getQueue(room.id);
    expect(q.map((i) => i.id)).toEqual([b.id]);
    expect(q.some((i) => i.id === a.id)).toBe(false);

    await skip(room.id, host.id); // no next → idle, queue empties
    pb = await getPlaybackState(room.id);
    expect(pb.status).toBe('idle');
    expect(pb.currentTrackId).toBeNull();
    q = await getQueue(room.id);
    expect(q).toHaveLength(0);
  });

  it('skip removes the skipped track even with three queued (A,B,C → B playing, C)', async () => {
    const { host, room } = await freshRoom();
    const a = await addTrack(room.id, host.id, VID1); // current
    const b = await addTrack(room.id, host.id, VID2);
    const c = await addTrack(room.id, host.id, VID3);

    await skip(room.id, host.id);
    const pb = await getPlaybackState(room.id);
    expect(pb.currentTrackId).toBe(b.id);
    const q = await getQueue(room.id);
    expect(q.map((i) => i.id)).toEqual([b.id, c.id]); // A gone, positions recompacted
    expect(q.map((i) => i.position)).toEqual([0, 1]);
    void a;
  });

  it('ANY participant (guest) can skip — not host-only', async () => {
    const { host, room } = await freshRoom();
    const a = await addTrack(room.id, host.id, VID1); // current
    const b = await addTrack(room.id, host.id, VID2);
    const guest = await newSession('Guest');
    await joinRoom({ code: room.code, avatar: null }, guest);

    await skip(room.id, guest.id); // guest skips
    const pb = await getPlaybackState(room.id);
    expect(pb.currentTrackId).toBe(b.id); // advanced to next
    const q = await getQueue(room.id);
    expect(q.map((i) => i.id)).toEqual([b.id]); // skipped (current) track removed
    void a;
  });

  it('a non-participant cannot skip (must have joined the room)', async () => {
    const { host, room } = await freshRoom();
    await addTrack(room.id, host.id, VID1);
    const outsider = await newSession('Outsider'); // session exists but never joined
    await expectAppError(skip(room.id, outsider.id), ERRORS.SESSION_REQUIRED.code);
  });

  it('advanceIfCurrent is idempotent (no-op for a stale endedItemId)', async () => {
    const { host, room } = await freshRoom();
    const a = await addTrack(room.id, host.id, VID1);
    await addTrack(room.id, host.id, VID2);
    await advanceIfCurrent(room.id, 'not-the-current-id');
    const pb = await getPlaybackState(room.id);
    expect(pb.currentTrackId).toBe(a.id); // unchanged
  });

  it('three tracks advance in order via ENDED', async () => {
    const { host, room } = await freshRoom();
    const a = await addTrack(room.id, host.id, VID1);
    const b = await addTrack(room.id, host.id, VID2);
    const c = await addTrack(room.id, host.id, VID3);
    await advanceIfCurrent(room.id, a.id);
    expect((await getPlaybackState(room.id)).currentTrackId).toBe(b.id);
    await advanceIfCurrent(room.id, b.id);
    expect((await getPlaybackState(room.id)).currentTrackId).toBe(c.id);
    await advanceIfCurrent(room.id, c.id);
    expect((await getPlaybackState(room.id)).status).toBe('idle');
  });

  it('removes each finished track from the queue on natural advance (no history)', async () => {
    const { host, room } = await freshRoom();
    const a = await addTrack(room.id, host.id, VID1); // current
    const b = await addTrack(room.id, host.id, VID2);
    const c = await addTrack(room.id, host.id, VID3);

    await advanceIfCurrent(room.id, a.id); // a finishes → removed, b current
    expect((await getQueue(room.id)).map((i) => i.id)).toEqual([b.id, c.id]);

    await advanceIfCurrent(room.id, b.id); // b finishes → removed, c current
    expect((await getQueue(room.id)).map((i) => i.id)).toEqual([c.id]);

    await advanceIfCurrent(room.id, c.id); // c finishes → removed, idle + empty
    expect(await getQueue(room.id)).toHaveLength(0);
    expect((await getPlaybackState(room.id)).status).toBe('idle');
  });
});

describe('clearQueue + reportDuration', () => {
  it('clear empties the queue and goes idle', async () => {
    const { host, room } = await freshRoom();
    await addTrack(room.id, host.id, VID1);
    await addTrack(room.id, host.id, VID2);
    await clearQueue(room.id, host.id);
    expect(await getQueue(room.id)).toHaveLength(0);
    expect((await getPlaybackState(room.id)).status).toBe('idle');
  });

  it('reportDuration corrects the placeholder duration', async () => {
    const { host, room } = await freshRoom();
    const item = await addTrack(room.id, host.id, VID1);
    expect(item.durationMs).toBe(0);
    await reportDuration(room.id, host.id, item.id, 213_000);
    const q = await getQueue(room.id);
    expect(q[0]!.durationMs).toBe(213_000);
    const room2 = await prisma.room.findUnique({ where: { id: room.id } });
    expect(Number(room2?.pbCurrentDurationMs)).toBe(213_000);
  });
});
