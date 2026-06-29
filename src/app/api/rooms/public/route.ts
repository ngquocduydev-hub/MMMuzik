import type { NextRequest } from 'next/server';
import { handleRouteError, jsonOk } from '@/lib/api';
import { listPublicRooms } from '@/server/services/roomService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/rooms/public — active public rooms for the browse list (most-recently
 * active first). Private/closed rooms are never returned.
 */
export async function GET(_req: NextRequest) {
  try {
    const rooms = await listPublicRooms();
    return jsonOk({ rooms });
  } catch (err) {
    return handleRouteError(err);
  }
}
