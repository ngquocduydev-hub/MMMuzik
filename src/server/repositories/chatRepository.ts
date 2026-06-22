import type { ChatMessage } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * All chat DB access (ARCHITECTURE §8.2 — no Prisma in services). This is the
 * ONLY place chat_messages is queried, so the soft-delete read filter
 * (`isDeleted: false`) is centralized here — Prisma has no global query filter
 * (docs/DATABASE.md §soft-delete).
 */
export function createMessage(data: {
  roomId: string;
  sessionId: string;
  nickname: string;
  body: string;
}): Promise<ChatMessage> {
  return prisma.chatMessage.create({ data });
}

/**
 * Recent history, oldest-first (REQ-CHAT-3). Reads the newest `take` rows by
 * sent_at, then reverses to chronological order for display. Soft-deleted
 * messages are excluded.
 */
export async function listRecent(roomId: string, take: number): Promise<ChatMessage[]> {
  const rows = await prisma.chatMessage.findMany({
    where: { roomId, isDeleted: false },
    orderBy: { sentAt: 'desc' },
    take,
  });
  return rows.reverse();
}
