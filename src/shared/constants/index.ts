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
} as const;

// ── auto-next (Phase 6) ────────────────────────────────────────────────────
export const ADVANCE_GRACE_MS = 1500; // tolerance before the timer declares end
export const ADVANCE_TICK_MS = 1000; // server advance-worker poll interval
export const ADVANCE_LOCK_TTL_S = 15; // Redis advance-lock TTL

// ── chat (SPEC §7.11 / REQ-CHAT) ───────────────────────────────────────────
export const CHAT_MAX_LENGTH = 2000; // REQ-CHAT-4 — body upper bound
export const CHAT_HISTORY_DEFAULT = 50; // REQ-CHAT-3 — default recent-history page
export const CHAT_HISTORY_MAX = 100; // REQ-CHAT-3 — hard ceiling on a history page
