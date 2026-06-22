import { handleRouteError, jsonOk } from '@/lib/api';
import { readSessionCookie } from '@/lib/cookies';
import { getValidSession } from '@/server/services/sessionService';
import { toSessionDto } from '@/server/mappers';

export const dynamic = 'force-dynamic';

/** GET /api/session — the caller's current guest session (from cookie), or null. */
export async function GET() {
  try {
    const session = await getValidSession(await readSessionCookie());
    return jsonOk({ session: session ? toSessionDto(session) : null });
  } catch (err) {
    return handleRouteError(err);
  }
}
