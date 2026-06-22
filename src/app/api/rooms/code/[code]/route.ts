import type { NextRequest } from 'next/server';
import { roomCodeSchema } from '@/shared/validation';
import { handleRouteError, jsonOk } from '@/lib/api';
import { getRoomSummaryByCode } from '@/server/services/roomService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/rooms/code/:code — pre-join room summary (name, listeners, now playing).
 * Used by the invite/join screen before a nickname is entered. 404 if the code is
 * unknown or the room has closed.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const summary = await getRoomSummaryByCode(roomCodeSchema.parse(code));
    return jsonOk({ summary });
  } catch (err) {
    return handleRouteError(err);
  }
}
