import type { Session } from '@prisma/client';
import {
  findSessionById,
  createSession,
  touchSession,
} from '@/server/repositories/sessionRepository';
import { SESSION_TTL_MS } from '@/shared/constants';

/**
 * Guest sessions — no login/password/OAuth. The cookie value is the session id;
 * a returning browser restores the same session (sliding 30-day expiry).
 */
export async function resolveOrCreateSession(
  cookieValue: string | null,
  identity: { displayName: string; avatar: string | null },
): Promise<{ session: Session; isNew: boolean }> {
  const now = Date.now();
  if (cookieValue) {
    const existing = await findSessionById(cookieValue);
    if (existing && existing.expiresAt.getTime() > now) {
      await touchSession(existing.id, new Date(now + SESSION_TTL_MS));
      return { session: existing, isNew: false };
    }
  }
  const session = await createSession({
    displayName: identity.displayName,
    avatar: identity.avatar,
    expiresAt: new Date(now + SESSION_TTL_MS),
  });
  return { session, isNew: true };
}

/** Resolve a valid (non-expired) session from the cookie, or null. */
export async function getValidSession(cookieValue: string | null): Promise<Session | null> {
  if (!cookieValue) return null;
  const session = await findSessionById(cookieValue);
  if (!session || session.expiresAt.getTime() <= Date.now()) return null;
  return session;
}
