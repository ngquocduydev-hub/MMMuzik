import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME, SESSION_TTL_MS } from '@/shared/constants';
import { isProduction } from './config';

/**
 * Session cookie helpers (httpOnly). Same-origin deployment ⇒ `SameSite=Lax`
 * is sufficient and no cross-site `SameSite=None` is needed (LESSONS L-7.2).
 */
export async function readSessionCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function writeSessionCookie(sessionId: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}
