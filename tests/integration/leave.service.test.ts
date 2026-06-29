import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { resetDb, resetRedis, teardown, newSession } from './setup';
import {
  createRoom,
  joinRoom,
  leaveRoom,
  listParticipants,
  getRoom,
} from '@/server/services/roomService';

beforeEach(async () => {
  await resetDb();
  await resetRedis();
});
afterAll(teardown);

describe('leaveRoom — host transfer & close (SPEC §7.10)', () => {
  it('non-host leaving removes only them; host unchanged', async () => {
    const host = await newSession('Host');
    const { room } = await createRoom({ name: 'P', nickname: 'DJ', avatar: null }, host.id);
    const guest = await newSession('Guest');
    await joinRoom({ code: room.code, avatar: null }, guest);

    const result = await leaveRoom(room.id, guest.id);
    expect(result.hostChanged).toBe(false);
    expect(result.roomClosed).toBe(false);
    const remaining = await listParticipants(room.id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.role).toBe('host');
  });

  it('host leaving transfers to the longest-present remaining participant', async () => {
    const host = await newSession('Host');
    const { room } = await createRoom({ name: 'P', nickname: 'DJ', avatar: null }, host.id);
    const g1 = await newSession('G1');
    const g2 = await newSession('G2');
    await joinRoom({ code: room.code, avatar: null }, g1); // joins first → longest-present
    await joinRoom({ code: room.code, avatar: null }, g2);

    const result = await leaveRoom(room.id, host.id);
    expect(result.roomClosed).toBe(false);
    expect(result.hostChanged).toBe(true);
    expect(result.newHostSessionId).toBe(g1.id);

    const updated = await getRoom(room.id);
    expect(updated.hostSessionId).toBe(g1.id);
    const parts = await listParticipants(room.id);
    expect(parts.find((p) => p.sessionId === g1.id)!.role).toBe('host');
    expect(parts.filter((p) => p.role === 'host')).toHaveLength(1); // exactly one host
  });

  it('last participant leaving makes the room idle (not closed) so it stays discoverable', async () => {
    const host = await newSession('Host');
    const { room } = await createRoom({ name: 'P', nickname: 'DJ', avatar: null }, host.id);
    const result = await leaveRoom(room.id, host.id);
    expect(result.roomClosed).toBe(false);
    const updated = await getRoom(room.id);
    expect(updated.status).toBe('idle');
  });

  it('joining an abandoned (idle) room reactivates it and reclaims host', async () => {
    const host = await newSession('Host');
    const { room } = await createRoom({ name: 'P', nickname: 'DJ', avatar: null }, host.id);
    await leaveRoom(room.id, host.id); // room → idle, no host
    expect((await getRoom(room.id)).status).toBe('idle');

    const newcomer = await newSession('Newcomer');
    const { room: rejoined, participant } = await joinRoom(
      { code: room.code, avatar: null },
      newcomer,
    );
    expect(rejoined.status).toBe('active');
    expect(rejoined.hostSessionId).toBe(newcomer.id);
    expect(participant.role).toBe('host');
    const parts = await listParticipants(room.id);
    expect(parts.filter((p) => p.role === 'host')).toHaveLength(1); // exactly one host
  });
});
