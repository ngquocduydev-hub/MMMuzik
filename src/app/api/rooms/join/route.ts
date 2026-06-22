import type { NextRequest } from 'next/server';
import { joinRoomSchema } from '@/shared/validation';
import { handleRouteError, jsonOk } from '@/lib/api';
import { readSessionCookie, writeSessionCookie } from '@/lib/cookies';
import { resolveOrCreateSession } from '@/server/services/sessionService';
import { joinRoom } from '@/server/services/roomService';
import { toRoomDto, toParticipantDto, toSessionDto } from '@/server/mappers';

export const dynamic = 'force-dynamic';

/** POST /api/rooms/join — join an active room by code; caller becomes MEMBER. */
export async function POST(req: NextRequest) {
  try {
    const body = joinRoomSchema.parse(await req.json().catch(() => ({})));
    const cookie = await readSessionCookie();
    const { session } = await resolveOrCreateSession(cookie, {
      displayName: body.nickname ?? 'Guest',
      avatar: body.avatar ?? null,
    });
    const { room, participant } = await joinRoom(
      { code: body.code, nickname: body.nickname, avatar: body.avatar ?? null },
      session,
    );
    await writeSessionCookie(session.id);
    return jsonOk({
      room: toRoomDto(room),
      participant: toParticipantDto(participant),
      session: toSessionDto(session),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
