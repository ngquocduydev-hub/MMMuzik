import type { NextRequest } from 'next/server';
import { roomIdSchema } from '@/shared/validation';
import { handleRouteError, jsonOk } from '@/lib/api';
import { getPlaybackState } from '@/server/services/playbackService';
import { serverNowMs } from '@/server/services/clockSyncService';

export const dynamic = 'force-dynamic';

/** GET /api/rooms/:id/playback — anchor + server clock (join-in-progress sync). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const roomId = roomIdSchema.parse(id);
    const playback = await getPlaybackState(roomId);
    return jsonOk({ playback, serverTimestampUtc: serverNowMs() });
  } catch (err) {
    return handleRouteError(err);
  }
}
