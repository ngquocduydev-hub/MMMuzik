import type { AppSocket } from './io';
import { getValidSession } from '@/server/services/sessionService';
import { SESSION_COOKIE_NAME } from '@/shared/constants';
import { logger } from '@/lib/logger';

/**
 * Handshake authentication (REALTIME §3): bind the session from the httpOnly
 * cookie. Identity is NEVER read from an event payload. A connection with no
 * valid session is allowed but unauthenticated (`sessionId = null`); commands
 * that require host authority will then fail the authority check.
 */
export async function authMiddleware(
  socket: AppSocket,
  next: (err?: Error) => void,
): Promise<void> {
  try {
    const sessionId = parseSessionCookie(socket.handshake.headers.cookie ?? '');
    const session = sessionId ? await getValidSession(sessionId) : null;
    socket.data.sessionId = session?.id ?? null;
    logger.debug({ socketId: socket.id, hasSession: Boolean(session) }, 'handshake');
    next();
  } catch (err) {
    logger.error({ err }, 'handshake auth error');
    socket.data.sessionId = null;
    next();
  }
}

function parseSessionCookie(cookieHeader: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE_NAME) return decodeURIComponent(rest.join('=')) || null;
  }
  return null;
}
