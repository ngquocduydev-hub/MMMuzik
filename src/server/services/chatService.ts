import type { Room } from '@prisma/client';
import { validateMessageBody } from '@/shared/domain/chat';
import { AppError, ERRORS } from '@/shared/errors';
import { CHAT_HISTORY_DEFAULT, CHAT_HISTORY_MAX } from '@/shared/constants';
import type { ChatMessageDto } from '@/shared/types';
import { logger } from '@/lib/logger';
import * as roomRepo from '@/server/repositories/roomRepository';
import * as chatRepo from '@/server/repositories/chatRepository';
import { toChatMessageDto } from '@/server/mappers';
import { emitToRoom } from '@/server/realtime/emitter';

/**
 * Server-authoritative chat. A participant sends a body; the server validates,
 * persists (the row is the source of truth), then broadcasts via the Redis
 * emitter so the message fans out across instances AND from REST/socket alike.
 * The sender's nickname is snapshotted at send time (REQ-CHAT-2). Chat stays
 * usable even when playback is degraded (REQ-CHAT-7) — it shares no state with it.
 */

async function requireActiveRoom(roomId: string): Promise<Room> {
  const room = await roomRepo.findRoomById(roomId);
  if (!room) throw new AppError(ERRORS.ROOM_NOT_FOUND, 'Room not found');
  if (room.status === 'closed') throw new AppError(ERRORS.ROOM_CLOSED, 'This room has ended');
  return room;
}

/** Send a message. Any current participant may send; non-members are rejected. */
export async function sendMessage(
  roomId: string,
  sessionId: string | null,
  rawBody: string,
): Promise<ChatMessageDto> {
  await requireActiveRoom(roomId);
  if (!sessionId) throw new AppError(ERRORS.SESSION_REQUIRED, 'No active session');
  const participant = await roomRepo.findParticipant(roomId, sessionId);
  if (!participant) throw new AppError(ERRORS.SESSION_REQUIRED, 'Join the room first');

  const result = validateMessageBody(rawBody);
  if (!result.ok) {
    throw result.reason === 'empty'
      ? new AppError(ERRORS.CHAT_EMPTY, 'Message cannot be empty')
      : new AppError(ERRORS.CHAT_TOO_LONG, 'Message is too long');
  }

  const message = await chatRepo.createMessage({
    roomId,
    sessionId,
    nickname: participant.nickname, // snapshot (REQ-CHAT-2)
    body: result.body,
  });
  const dto = toChatMessageDto(message);

  emitToRoom(roomId, 'chat:messagePosted', { roomId, message: dto });
  logger.info({ roomId, sessionId, messageId: dto.id }, 'chat:send');
  return dto;
}

/** Recent history, oldest-first, clamped to [1, CHAT_HISTORY_MAX] (REQ-CHAT-3). */
export async function getHistory(
  roomId: string,
  take: number = CHAT_HISTORY_DEFAULT,
): Promise<ChatMessageDto[]> {
  const limit = Math.min(Math.max(1, Math.trunc(take)), CHAT_HISTORY_MAX);
  const rows = await chatRepo.listRecent(roomId, limit);
  return rows.map(toChatMessageDto);
}
