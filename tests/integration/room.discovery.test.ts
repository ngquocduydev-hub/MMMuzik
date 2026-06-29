import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { resetDb, resetRedis, teardown, newSession } from './setup';
import { createRoom, joinRoom, listPublicRooms } from '@/server/services/roomService';
import { setOnline, findReapableRoomIds, deleteRooms } from '@/server/repositories/roomRepository';
import { ROOM_INACTIVE_GRACE_MS } from '@/shared/constants';
import { prisma } from '@/lib/prisma';

/** The threshold the reaper worker passes: rooms idle since before this are reapable. */
const graceThreshold = () => new Date(Date.now() - ROOM_INACTIVE_GRACE_MS);

beforeEach(async () => {
  await resetDb();
  await resetRedis();
});
afterAll(teardown);

describe('listPublicRooms', () => {
  it('lists public AND private rooms (private locked); excludes closed', async () => {
    const pub = await createRoom(
      { name: 'Public Party', nickname: 'A', avatar: null, visibility: 'public' },
      (await newSession('A')).id,
    );
    const priv = await createRoom(
      { name: 'Secret', nickname: 'B', avatar: null, visibility: 'private' },
      (await newSession('B')).id,
    );
    const closed = await createRoom(
      { name: 'Old Public', nickname: 'C', avatar: null, visibility: 'public' },
      (await newSession('C')).id,
    );
    await prisma.room.update({ where: { id: closed.room.id }, data: { status: 'closed' } });

    const rooms = await listPublicRooms();
    expect(rooms.map((r) => r.id).sort()).toEqual([pub.room.id, priv.room.id].sort());

    const publicItem = rooms.find((r) => r.id === pub.room.id)!;
    expect(publicItem.visibility).toBe('public');
    expect(publicItem.code).toBe(pub.room.code); // exposed → one-click join

    const privateItem = rooms.find((r) => r.id === priv.room.id)!;
    expect(privateItem.visibility).toBe('private');
    expect(privateItem.code).toBeNull(); // withheld → must enter the code
    expect(privateItem.nowPlayingTitle).toBeNull();
  });

  it('counts only ONLINE participants as listeners', async () => {
    const host = await newSession('Host');
    const { room } = await createRoom(
      { name: 'Pub', nickname: 'Host', avatar: null, visibility: 'public' },
      host.id,
    );
    const guest = await newSession('Guest');
    await joinRoom({ code: room.code, nickname: 'Guest', avatar: null }, guest);

    expect((await listPublicRooms())[0]?.listenerCount).toBe(2);

    await setOnline(room.id, guest.id, false);
    expect((await listPublicRooms())[0]?.listenerCount).toBe(1);
  });
});

describe('inactive-room reaper', () => {
  it('flags only empty rooms whose last activity predates the threshold', async () => {
    const host = await newSession('Host');
    const { room } = await createRoom(
      { name: 'R', nickname: 'Host', avatar: null, visibility: 'public' },
      host.id,
    );

    // Fresh room: host is online → never reapable.
    expect(await findReapableRoomIds(graceThreshold())).not.toContain(room.id);

    // Host disconnects: 0 online, but setOnline bumps lastActivityAt to "now",
    // so the grace window has NOT elapsed yet.
    await setOnline(room.id, host.id, false);
    expect(await findReapableRoomIds(graceThreshold())).not.toContain(room.id);

    // Push last activity beyond the grace window → now within the reaper's reach.
    await prisma.room.update({
      where: { id: room.id },
      data: { lastActivityAt: new Date(Date.now() - 2 * ROOM_INACTIVE_GRACE_MS) },
    });
    expect(await findReapableRoomIds(graceThreshold())).toContain(room.id);
  });

  it('never flags a room that still has an online participant, even if stale', async () => {
    const host = await newSession('Host');
    const { room } = await createRoom(
      { name: 'Busy', nickname: 'Host', avatar: null, visibility: 'public' },
      host.id,
    );
    await prisma.room.update({
      where: { id: room.id },
      data: { lastActivityAt: new Date(Date.now() - 2 * ROOM_INACTIVE_GRACE_MS) },
    });
    expect(await findReapableRoomIds(graceThreshold())).not.toContain(room.id);
  });

  it('hard-deletes reaped rooms and cascades participants', async () => {
    const host = await newSession('Host');
    const { room } = await createRoom(
      { name: 'Doomed', nickname: 'Host', avatar: null, visibility: 'public' },
      host.id,
    );
    await setOnline(room.id, host.id, false);
    await prisma.room.update({
      where: { id: room.id },
      data: { lastActivityAt: new Date(Date.now() - 60 * 60 * 1000) },
    });

    const deleted = await deleteRooms([room.id]);
    expect(deleted).toBe(1);
    expect(await prisma.room.findUnique({ where: { id: room.id } })).toBeNull();
    expect(await prisma.participant.count({ where: { roomId: room.id } })).toBe(0);
  });
});
