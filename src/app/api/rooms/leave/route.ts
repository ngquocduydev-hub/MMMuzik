import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { handleRouteError, jsonOk } from '@/lib/api';
import { AppError, ERRORS } from '@/shared/errors';
import { readSessionCookie } from '@/lib/cookies';
import { getValidSession } from '@/server/services/sessionService';
import { leaveRoom } from '@/server/services/roomService';
import { emitToRoom } from '@/server/realtime/emitter';

export const dynamic = 'force-dynamic';

const leaveSchema = z.object({ roomId: z.string().uuid('Invalid room id') });

/** POST /api/rooms/leave — remove the caller; host-transfer or close; broadcast. */
export async function POST(req: NextRequest) {
  try {
    const { roomId } = leaveSchema.parse(await req.json().catch(() => ({})));
    const session = await getValidSession(await readSessionCookie());
    if (!session) throw new AppError(ERRORS.SESSION_REQUIRED, 'No active session');

    const result = await leaveRoom(roomId, session.id);

    // REST-originated → broadcast through the Redis emitter.
    emitToRoom(roomId, 'presence:participantLeft', { roomId, sessionId: session.id });
    if (result.hostChanged && result.newHostSessionId) {
      emitToRoom(roomId, 'presence:hostChanged', {
        roomId,
        newHostSessionId: result.newHostSessionId,
      });
    }
    if (result.roomClosed) {
      emitToRoom(roomId, 'room:closed', { roomId, reason: 'host_left' });
    }

    return jsonOk({ left: true, ...result });
  } catch (err) {
    return handleRouteError(err);
  }
}
