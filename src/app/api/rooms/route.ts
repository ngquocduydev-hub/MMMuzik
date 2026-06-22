import type { NextRequest } from 'next/server';
import { createRoomSchema } from '@/shared/validation';
import { handleRouteError, jsonOk } from '@/lib/api';
import { readSessionCookie, writeSessionCookie } from '@/lib/cookies';
import { resolveOrCreateSession } from '@/server/services/sessionService';
import { createRoom } from '@/server/services/roomService';
import { toRoomDto, toParticipantDto, toSessionDto } from '@/server/mappers';

export const dynamic = 'force-dynamic';

/** POST /api/rooms — create a room; caller becomes HOST. */
export async function POST(req: NextRequest) {
  try {
    const body = createRoomSchema.parse(await req.json().catch(() => ({})));
    const cookie = await readSessionCookie();
    const { session } = await resolveOrCreateSession(cookie, {
      displayName: body.nickname,
      avatar: body.avatar ?? null,
    });
    const { room, participant } = await createRoom(
      { name: body.name, nickname: body.nickname, avatar: body.avatar ?? null },
      session.id,
    );
    await writeSessionCookie(session.id);
    return jsonOk(
      {
        room: toRoomDto(room),
        participant: toParticipantDto(participant),
        session: toSessionDto(session),
      },
      201,
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
