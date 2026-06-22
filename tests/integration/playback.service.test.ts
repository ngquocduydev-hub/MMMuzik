import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { resetDb, resetRedis, teardown, newSession, expectAppError } from './setup';
import { createRoom, joinRoom } from '@/server/services/roomService';
import {
  playbackPlay,
  playbackPause,
  playbackSeek,
  getPlaybackState,
} from '@/server/services/playbackService';
import { getPlaybackCache } from '@/server/cache/playbackCache';
import { ERRORS } from '@/shared/errors';
import { prisma } from '@/lib/prisma';

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

describe('authority (server is the only playback authority)', () => {
  it('host can play; state persists to Postgres AND Redis', async () => {
    const { host, room } = await freshRoom();
    const dto = await playbackPlay(room.id, host.id);
    expect(dto.status).toBe('playing');
    expect(dto.revision).toBe(1);

    const cached = await getPlaybackCache(room.id);
    expect(cached?.status).toBe('playing');
    expect(cached?.revision).toBe(1);

    const db = await prisma.room.findUnique({ where: { id: room.id } });
    expect(db?.pbStatus).toBe('playing');
    expect(Number(db?.pbRevision)).toBe(1);
  });

  it('non-host is rejected with PLAYBACK_FORBIDDEN', async () => {
    const { room } = await freshRoom();
    const guest = await newSession('Guest');
    await joinRoom({ code: room.code, avatar: null }, guest);
    await expectAppError(playbackPlay(room.id, guest.id), ERRORS.PLAYBACK_FORBIDDEN.code);
  });

  it('anonymous (null session) is rejected', async () => {
    const { room } = await freshRoom();
    await expectAppError(playbackPlay(room.id, null), ERRORS.PLAYBACK_FORBIDDEN.code);
  });
});

describe('commands', () => {
  it('play → pause → resume keeps a monotonic revision and persists status', async () => {
    const { host, room } = await freshRoom();
    expect((await playbackPlay(room.id, host.id)).status).toBe('playing'); // rev 1
    expect((await playbackPause(room.id, host.id)).status).toBe('paused'); // rev 2
    const resumed = await playbackPlay(room.id, host.id); // rev 3
    expect(resumed.status).toBe('playing');
    expect(resumed.revision).toBe(3);
  });

  it('play is idempotent — second play does not bump revision', async () => {
    const { host, room } = await freshRoom();
    await playbackPlay(room.id, host.id); // rev 1
    const again = await playbackPlay(room.id, host.id); // no-op
    expect(again.revision).toBe(1);
  });

  it('rapid play/pause stays consistent and ends paused', async () => {
    const { host, room } = await freshRoom();
    await playbackPlay(room.id, host.id);
    await playbackPause(room.id, host.id);
    await playbackPlay(room.id, host.id);
    const last = await playbackPause(room.id, host.id);
    expect(last.status).toBe('paused');
    expect(last.revision).toBe(4);
  });

  it('seek while playing keeps playing at the new position', async () => {
    const { host, room } = await freshRoom();
    await playbackPlay(room.id, host.id);
    const dto = await playbackSeek(room.id, host.id, 60_000);
    expect(dto.status).toBe('playing');
    expect(dto.positionMs).toBe(60_000);
  });

  it('seek while paused stays paused at the new position', async () => {
    const { host, room } = await freshRoom();
    await playbackPlay(room.id, host.id);
    await playbackPause(room.id, host.id);
    const dto = await playbackSeek(room.id, host.id, 42_000);
    expect(dto.status).toBe('paused');
    expect(dto.positionMs).toBe(42_000);
  });

  it('rejects a negative seek position', async () => {
    const { host, room } = await freshRoom();
    await expectAppError(playbackSeek(room.id, host.id, -1), ERRORS.PLAYBACK_INVALID_POSITION.code);
  });

  it('carries currentTrackId (mock) through transitions', async () => {
    const { host, room } = await freshRoom();
    const trackId = randomUUID();
    await prisma.room.update({ where: { id: room.id }, data: { pbCurrentItemId: trackId } });
    const dto = await playbackPlay(room.id, host.id);
    expect(dto.currentTrackId).toBe(trackId);
  });
});

describe('join-in-progress + reconnect (no stale state)', () => {
  it('getPlaybackState returns the latest anchor (what a joiner/reconnector fetches)', async () => {
    const { host, room } = await freshRoom();
    await playbackPlay(room.id, host.id); // rev 1
    const afterSeek = await playbackSeek(room.id, host.id, 30_000); // rev 2

    const fetched = await getPlaybackState(room.id);
    expect(fetched.revision).toBe(2); // not stale
    expect(fetched.positionMs).toBe(30_000);
    expect(fetched).toEqual(afterSeek); // multi-client: fetched == broadcast payload
  });

  it('getPlaybackState warms the cache from Postgres on a cold read', async () => {
    const { room } = await freshRoom();
    await resetRedis(); // simulate cold cache (e.g. after restart)
    const fetched = await getPlaybackState(room.id);
    expect(fetched.status).toBe('idle');
    expect(await getPlaybackCache(room.id)).not.toBeNull(); // re-warmed
  });

  it('getPlaybackState throws ROOM_NOT_FOUND for an unknown room', async () => {
    await expectAppError(getPlaybackState(randomUUID()), ERRORS.ROOM_NOT_FOUND.code);
  });
});
