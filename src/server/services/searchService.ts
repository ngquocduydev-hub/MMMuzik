import { createHash } from 'node:crypto';
import { getRedis } from '@/lib/redis';
import { logger } from '@/lib/logger';
import {
  redisKeys,
  SEARCH_MAX_RESULTS,
  SEARCH_CACHE_TTL_S,
  SEARCH_RATE_LIMIT,
  SEARCH_RATE_WINDOW_MS,
  SEARCH_LIST_COST,
  SEARCH_ENRICH_COST,
  SEARCH_DAILY_QUOTA_BUDGET,
} from '@/shared/constants';
import { AppError, ERRORS } from '@/shared/errors';
import type { SearchResponseDto, SearchResultDto } from '@/shared/types';
import * as roomRepo from '@/server/repositories/roomRepository';
import { consumeRateLimit } from '@/server/services/rateLimiter';
import { searchYouTube } from '@/server/services/youtubeDataApi';

/**
 * Search orchestration (docs/features/youtube-in-app-search Phase 2). The single
 * server-side choke point for YouTube search — holds the quota controls the raw
 * Data API call must never be called without:
 *   - participant gate (don't let non-members burn the shared quota)
 *   - per-(room, session) rate limit (independent of the add limit)
 *   - read-through Redis result cache (repeat/popular queries cost 0 units)
 *   - daily quota-budget circuit breaker → degrade to URL-paste (available:false)
 * The API key lives only here/in youtubeDataApi — NEVER on the client.
 */

/** Normalize for cache hits: trim, lowercase, collapse internal whitespace. */
export function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, ' ');
}

function queryHash(q: string): string {
  return createHash('sha1').update(normalizeQuery(q)).digest('hex');
}

/** UTC day bucket (YYYY-MM-DD) for the daily quota counter. */
function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/**
 * Search for tracks to add. Throws SESSION_REQUIRED (not a participant), validation
 * (empty query), or RATE_LIMITED. Returns `{ available:false, results:[] }` when
 * search is degraded (no API key or daily quota spent) so the UI falls back to
 * pasting a link — distinct from a genuine empty result set.
 */
export async function searchTracks(
  roomId: string,
  sessionId: string | null,
  rawQuery: string,
  now: number = Date.now(),
): Promise<SearchResponseDto> {
  if (!sessionId) throw new AppError(ERRORS.SESSION_REQUIRED, 'No active session');
  const participant = await roomRepo.findParticipant(roomId, sessionId);
  if (!participant) throw new AppError(ERRORS.SESSION_REQUIRED, 'Join the room first');

  const query = rawQuery.trim();
  if (!query) return { available: true, results: [] };

  const rl = await consumeRateLimit(
    'search',
    `${roomId}:${sessionId}`,
    SEARCH_RATE_LIMIT,
    SEARCH_RATE_WINDOW_MS,
  );
  if (!rl.allowed) {
    throw new AppError(
      ERRORS.RATE_LIMITED,
      'Searching too fast — give it a moment',
      rl.retryAfterMs,
    );
  }

  return cachedSearch(query, now);
}

async function cachedSearch(query: string, now: number): Promise<SearchResponseDto> {
  const redis = getRedis();
  const cacheKey = redisKeys.searchCache(queryHash(query));

  const hit = await redis.get(cacheKey);
  if (hit) {
    return { available: true, results: JSON.parse(hit) as SearchResultDto[] };
  }

  // Circuit breaker: don't exceed the day's reserved quota budget.
  const quotaKey = redisKeys.searchQuotaDay(utcDay(now));
  const spent = Number((await redis.get(quotaKey)) ?? 0);
  if (spent + SEARCH_LIST_COST + SEARCH_ENRICH_COST > SEARCH_DAILY_QUOTA_BUDGET) {
    logger.warn({ spent }, 'search quota budget reached — degrading to URL-paste');
    return { available: false, results: [] };
  }

  let results: SearchResultDto[] | null;
  try {
    results = await searchYouTube(query, SEARCH_MAX_RESULTS);
  } catch (err) {
    // A Data API hiccup (5xx, network, transient throttle) must NOT brick search —
    // degrade to URL-paste rather than surfacing a 500 (plan: fall back when the API
    // errors so the room is never bricked when search dies).
    logger.warn({ err }, 'youtube search failed — degrading to URL-paste');
    return { available: false, results: [] };
  }
  if (results === null) {
    // No API key configured — search is unavailable; UI falls back to URL-paste.
    return { available: false, results: [] };
  }

  // Account the quota AFTER a successful call; open the daily window on first spend.
  const used = await redis.incrby(quotaKey, SEARCH_LIST_COST + SEARCH_ENRICH_COST);
  if (used === SEARCH_LIST_COST + SEARCH_ENRICH_COST) {
    await redis.expire(quotaKey, SEARCH_CACHE_TTL_S);
  }

  await redis.set(cacheKey, JSON.stringify(results), 'EX', SEARCH_CACHE_TTL_S);
  return { available: true, results };
}
