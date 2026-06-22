import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { resetDb, resetRedis, teardown, newSession, expectAppError } from './setup';
import { createRoom, joinRoom } from '@/server/services/roomService';
import { sendMessage, getHistory } from '@/server/services/chatService';
import { ERRORS } from '@/shared/errors';
import { CHAT_MAX_LENGTH } from '@/shared/constants';
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

describe('sendMessage', () => {
  it('persists a message and snapshots the sender nickname (REQ-CHAT-2)', async () => {
    const { host, room } = await freshRoom();
    const dto = await sendMessage(room.id, host.id, '  hello world  ');
    expect(dto.body).toBe('hello world'); // trimmed
    expect(dto.nickname).toBe('DJ');
    expect(dto.sessionId).toBe(host.id);

    const rows = await prisma.chatMessage.findMany({ where: { roomId: room.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.body).toBe('hello world');
  });

  it('any participant (non-host) can send', async () => {
    const { room } = await freshRoom();
    const guest = await newSession('Guest');
    await joinRoom({ code: room.code, avatar: null }, guest);
    const dto = await sendMessage(room.id, guest.id, 'hi from guest');
    expect(dto.nickname).toBe('Guest');
  });

  it('rejects an empty / whitespace-only message', async () => {
    const { host, room } = await freshRoom();
    await expectAppError(sendMessage(room.id, host.id, '   '), ERRORS.CHAT_EMPTY.code);
  });

  it('rejects an over-long message', async () => {
    const { host, room } = await freshRoom();
    const tooLong = 'a'.repeat(CHAT_MAX_LENGTH + 1);
    await expectAppError(sendMessage(room.id, host.id, tooLong), ERRORS.CHAT_TOO_LONG.code);
  });

  it('rejects a non-participant', async () => {
    const { room } = await freshRoom();
    const stranger = await newSession('Stranger'); // never joined
    await expectAppError(sendMessage(room.id, stranger.id, 'hi'), ERRORS.SESSION_REQUIRED.code);
  });

  it('rejects sending to a closed room', async () => {
    const { host, room } = await freshRoom();
    await prisma.room.update({ where: { id: room.id }, data: { status: 'closed' } });
    await expectAppError(sendMessage(room.id, host.id, 'hi'), ERRORS.ROOM_CLOSED.code);
  });
});

describe('getHistory (REQ-CHAT-3)', () => {
  it('returns recent messages oldest-first and respects the take limit', async () => {
    const { host, room } = await freshRoom();
    // Explicit sent_at so ordering is deterministic.
    for (let i = 0; i < 5; i++) {
      await prisma.chatMessage.create({
        data: {
          roomId: room.id,
          sessionId: host.id,
          nickname: 'DJ',
          body: `m${i}`,
          sentAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
        },
      });
    }
    const recent = await getHistory(room.id, 3);
    expect(recent.map((m) => m.body)).toEqual(['m2', 'm3', 'm4']); // newest 3, oldest-first
  });

  it('excludes soft-deleted messages', async () => {
    const { host, room } = await freshRoom();
    await sendMessage(room.id, host.id, 'visible');
    await prisma.chatMessage.create({
      data: { roomId: room.id, sessionId: host.id, nickname: 'DJ', body: 'gone', isDeleted: true },
    });
    const history = await getHistory(room.id);
    expect(history.map((m) => m.body)).toEqual(['visible']);
  });
});
