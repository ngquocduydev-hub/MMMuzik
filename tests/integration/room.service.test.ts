import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { resetDb, resetRedis, teardown, newSession, expectAppError } from './setup';
import { createRoom, joinRoom, listParticipants, getRoom } from '@/server/services/roomService';
import { ERRORS } from '@/shared/errors';
import { prisma } from '@/lib/prisma';

beforeEach(async () => {
  await resetDb();
  await resetRedis();
});
afterAll(teardown);

describe('createRoom', () => {
  it('creates an active room; creator is HOST + first participant', async () => {
    const host = await newSession('Host');
    const { room, participant } = await createRoom(
      { name: 'Party', nickname: 'DJ', avatar: null },
      host.id,
    );
    expect(room.code).toHaveLength(6);
    expect(room.status).toBe('active');
    expect(room.hostSessionId).toBe(host.id);
    expect(participant.role).toBe('host');
    expect(participant.nickname).toBe('DJ');
    expect(await listParticipants(room.id)).toHaveLength(1);
  });

  it('generates distinct codes across rooms', async () => {
    const a = await createRoom({ name: 'A', nickname: 'x', avatar: null }, (await newSession()).id);
    const b = await createRoom({ name: 'B', nickname: 'y', avatar: null }, (await newSession()).id);
    expect(a.room.code).not.toBe(b.room.code);
  });
});

describe('joinRoom', () => {
  it('adds a MEMBER and de-duplicates the nickname (FR-2.4)', async () => {
    const host = await newSession('Host');
    const { room } = await createRoom({ name: 'P', nickname: 'Duy', avatar: null }, host.id);
    const guest = await newSession('Guest');
    const { participant } = await joinRoom(
      { code: room.code, nickname: 'Duy', avatar: null },
      guest,
    );
    expect(participant.role).toBe('member');
    expect(participant.nickname).toBe('Duy (2)');
    expect(await listParticipants(room.id)).toHaveLength(2);
  });

  it('is idempotent for an existing participant (rejoin → no duplicate)', async () => {
    const host = await newSession('Host');
    const { room } = await createRoom({ name: 'P', nickname: 'DJ', avatar: null }, host.id);
    const { participant } = await joinRoom({ code: room.code, avatar: null }, host);
    expect(participant.role).toBe('host');
    expect(await listParticipants(room.id)).toHaveLength(1);
  });

  it('accepts a lowercase code (normalized) — same room', async () => {
    const host = await newSession('Host');
    const { room } = await createRoom({ name: 'P', nickname: 'DJ', avatar: null }, host.id);
    const guest = await newSession('Guest');
    const { room: joined } = await joinRoom({ code: room.code.toLowerCase(), avatar: null }, guest);
    expect(joined.id).toBe(room.id);
  });

  it('rejects an unknown code', async () => {
    const guest = await newSession();
    await expectAppError(
      joinRoom({ code: 'ZZZZZZ', avatar: null }, guest),
      ERRORS.ROOM_NOT_FOUND.code,
    );
  });

  it('rejects a closed room', async () => {
    const host = await newSession('Host');
    const { room } = await createRoom({ name: 'P', nickname: 'DJ', avatar: null }, host.id);
    await prisma.room.update({ where: { id: room.id }, data: { status: 'closed' } });
    const guest = await newSession();
    await expectAppError(
      joinRoom({ code: room.code, avatar: null }, guest),
      ERRORS.ROOM_CLOSED.code,
    );
  });
});

describe('getRoom', () => {
  it('throws ROOM_NOT_FOUND for an unknown id', async () => {
    await expectAppError(
      getRoom('00000000-0000-0000-0000-000000000000'),
      ERRORS.ROOM_NOT_FOUND.code,
    );
  });
});
