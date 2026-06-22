import type { NextRequest } from 'next/server';
import { roomIdSchema, chatHistoryQuerySchema } from '@/shared/validation';
import { handleRouteError, jsonOk } from '@/lib/api';
import { getRoom } from '@/server/services/roomService';
import { getHistory } from '@/server/services/chatService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/rooms/:id/messages?take=50 — recent chat history (oldest-first,
 * default 50, max 100). Fetched on join (REQ-CHAT-3); the live stream arrives
 * over Socket.IO. Clients dedupe by message id so ack + broadcast + history
 * never double-render.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const roomId = roomIdSchema.parse(id);
    await getRoom(roomId); // 404 if unknown
    const { take } = chatHistoryQuerySchema.parse({
      take: req.nextUrl.searchParams.get('take') ?? undefined,
    });
    return jsonOk({ messages: await getHistory(roomId, take) });
  } catch (err) {
    return handleRouteError(err);
  }
}
