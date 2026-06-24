import type { NextRequest } from 'next/server';
import { roomIdSchema, searchQuerySchema } from '@/shared/validation';
import { handleRouteError, jsonOk } from '@/lib/api';
import { readSessionCookie } from '@/lib/cookies';
import { getRoom } from '@/server/services/roomService';
import { searchTracks } from '@/server/services/searchService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/rooms/:id/search?q=… — in-app YouTube search (docs/features/youtube-in-app-search
 * Phase 2). Participant-gated; identity is the handshake-bound session COOKIE, never a
 * payload. Returns { available, results }: available:false means search is degraded
 * (no API key / quota spent) and the client should fall back to pasting a link.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const roomId = roomIdSchema.parse(id);
    await getRoom(roomId); // 404 if unknown
    const { q } = searchQuerySchema.parse({ q: req.nextUrl.searchParams.get('q') ?? '' });
    const sessionId = await readSessionCookie();
    return jsonOk(await searchTracks(roomId, sessionId, q));
  } catch (err) {
    return handleRouteError(err);
  }
}
