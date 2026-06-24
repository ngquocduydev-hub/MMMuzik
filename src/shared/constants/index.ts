/**
 * Shared constants — pure, framework-free (CLAUDE.md). All thresholds are
 * defaults; runtime config may override (see docs/PLAYBACK_ENGINE.md §14).
 */

// ── session ──────────────────────────────────────────────────────────────
export const SESSION_COOKIE_NAME = 'mmmuzik_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days (V1 §12.3)

// ── room ─────────────────────────────────────────────────────────────────
/** Human-friendly alphabet: excludes ambiguous I, L, O, 0, 1. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_MAX_ATTEMPTS = 8; // retry on unique-collision
export const ROOM_MAX_PARTICIPANTS = 50; // NFR-3

// ── playback drift bands (Phase 3: calculate only, no seeking) ─────────────
export const DRIFT_IGNORE_MS = 300; // |drift| < 300 → ignore
export const DRIFT_HARD_MS = 1000; //  |drift| > 1000 → hard; between → soft

// ── clock sync ─────────────────────────────────────────────────────────────
export const CLOCK_PING_SAMPLES = 5; // probes per round; lowest-RTT wins

// ── YouTube renderer (Phase 5) ─────────────────────────────────────────────
export const YT_PLAYER_HOST = 'https://www.youtube.com'; // NOT nocookie (L-3.2)
export const SEEK_COOLDOWN_MS = 2000; // min spacing between hard re-aligns (anti-thrash)
export const RECONCILE_TICK_MS = 1000; // how often the renderer checks drift

// ── redis keys ───────────────────────────────────────────────────────────
export const redisKeys = {
  playback: (roomId: string) => `room:${roomId}:playback`,
  queue: (roomId: string) => `room:${roomId}:queue`,
  advanceLock: (roomId: string, itemId: string) => `playback:advance-lock:${roomId}:${itemId}`,
  /** Fixed-window rate-limit counter, e.g. scope='queue-add:burst', id='roomId:sessionId'. */
  rateLimit: (scope: string, id: string) => `ratelimit:${scope}:${id}`,
  /** Read-through cache of a search result page, keyed by normalized-query hash. */
  searchCache: (queryHash: string) => `search:cache:${queryHash}`,
  /** Daily YouTube Data API quota-units counter (circuit breaker), keyed by YYYY-MM-DD. */
  searchQuotaDay: (day: string) => `search:quota:${day}`,
} as const;

// ── queue protection (docs/features/youtube-in-app-search Phase 1) ──────────
// All tunable from telemetry. Applied server-side to EVERY add path (paste + search).
export const QUEUE_MAX_SIZE = 500; // per-room ceiling backstop (bounds snapshot fan-out)
export const QUEUE_MAX_PENDING_PER_USER = 10; // anti-domination: upcoming items per session
export const QUEUE_ADD_BURST_LIMIT = 5; // adds allowed per burst window …
export const QUEUE_ADD_BURST_WINDOW_MS = 10_000; // … 10s
export const QUEUE_ADD_SUSTAINED_LIMIT = 30; // adds allowed per sustained window …
export const QUEUE_ADD_SUSTAINED_WINDOW_MS = 5 * 60_000; // … 5min

// ── search infrastructure (Phase 2) ─────────────────────────────────────────
export const SEARCH_QUERY_MAX_LEN = 100; // boundary cap on the query string
export const SEARCH_MAX_RESULTS = 12; // results per page (search.list maxResults)
export const SEARCH_CACHE_TTL_S = 24 * 60 * 60; // cache a query's results 24h (0 quota on repeats)
export const SEARCH_RATE_LIMIT = 10; // searches per window, per (room, session) …
export const SEARCH_RATE_WINDOW_MS = 10_000; // … 10s — protects the shared daily quota
export const SEARCH_LIST_COST = 100; // search.list quota cost (Data API)
export const SEARCH_ENRICH_COST = 1; // videos.list enrich cost (Data API)
/** Daily quota units reserved for search; below the 10k/day default so other
 *  Data API use (add-time guards) keeps headroom. Circuit-breaker ceiling. */
export const SEARCH_DAILY_QUOTA_BUDGET = 9000;

// ── "who's adding" presence cue (Phase 5) ───────────────────────────────────
export const QUEUE_ACTIVITY_TTL_MS = 3000; // a cue stays visible ~3s after the last ping
export const QUEUE_ACTIVITY_MIN_INTERVAL_MS = 2000; // client debounce between activity pings

// ── auto-next (Phase 6) ────────────────────────────────────────────────────
export const ADVANCE_GRACE_MS = 1500; // tolerance before the timer declares end
export const ADVANCE_TICK_MS = 1000; // server advance-worker poll interval
export const ADVANCE_LOCK_TTL_S = 15; // Redis advance-lock TTL

// ── chat (SPEC §7.11 / REQ-CHAT) ───────────────────────────────────────────
export const CHAT_MAX_LENGTH = 2000; // REQ-CHAT-4 — body upper bound
export const CHAT_HISTORY_DEFAULT = 50; // REQ-CHAT-3 — default recent-history page
export const CHAT_HISTORY_MAX = 100; // REQ-CHAT-3 — hard ceiling on a history page
