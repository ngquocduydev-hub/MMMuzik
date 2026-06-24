import { getRedis } from '@/lib/redis';
import { redisKeys } from '@/shared/constants';

/**
 * Reusable fixed-window rate limiter backed by Redis (INCR + PEXPIRE).
 *
 * The first hit in a window sets the window TTL; subsequent hits increment. Once
 * the count exceeds `limit`, calls are denied until the window expires. Simple,
 * convergent, and multi-instance-safe (the counter lives in shared Redis) — the
 * V2 anti-pattern guard against per-instance in-memory limits.
 *
 * Phase 1 of docs/features/youtube-in-app-search. Generic on purpose: chat send
 * and search can reuse it (CLAUDE.md: build the seam, one way to do something).
 */
export interface RateLimitResult {
  allowed: boolean;
  /** Remaining hits in the current window (0 when denied). */
  remaining: number;
  /** When denied, ms until the window resets; 0 when allowed. */
  retryAfterMs: number;
}

/**
 * Consume one hit against `scope:id`. `allowed=false` means the limit is exceeded.
 * @param scope logical bucket (e.g. 'queue-add:burst')
 * @param id    subject key (e.g. `${roomId}:${sessionId}`)
 */
export async function consumeRateLimit(
  scope: string,
  id: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const redis = getRedis();
  const key = redisKeys.rateLimit(scope, id);

  const count = await redis.incr(key);
  if (count === 1) {
    // First hit opens the window.
    await redis.pexpire(key, windowMs);
  }

  if (count > limit) {
    const ttl = await redis.pttl(key);
    return { allowed: false, remaining: 0, retryAfterMs: ttl > 0 ? ttl : windowMs };
  }
  return { allowed: true, remaining: Math.max(0, limit - count), retryAfterMs: 0 };
}
