import { DRIFT_IGNORE_MS, DRIFT_HARD_MS } from '../constants';

/**
 * Pure playback timeline domain — the deterministic core of the engine.
 *
 * Invariant (banking): `positionMs` is ALWAYS the true offset into the track AT
 * `updatedAtUtc`. Transitions take `now` (server epoch ms) as a parameter — the
 * domain never reads the clock (CLAUDE.md / PLAYBACK_ENGINE §2). No side effects.
 */
export type PlaybackStatus = 'idle' | 'playing' | 'paused';

export interface PlaybackAnchor {
  status: PlaybackStatus;
  currentTrackId: string | null;
  currentVideoId: string | null; // YouTube 11-char id (renderer binds to this)
  positionMs: number; // true offset AT updatedAtUtc
  updatedAtUtc: number; // server epoch ms
  revision: number; // monotonic
}

/** The position the track SHOULD be at, given server time `nowMs`. */
export function computeExpectedPosition(anchor: PlaybackAnchor, nowMs: number): number {
  if (anchor.status === 'playing') {
    return Math.max(0, anchor.positionMs + (nowMs - anchor.updatedAtUtc));
  }
  return anchor.positionMs; // paused / idle: frozen at banked offset
}

/** Start/resume playing from the banked offset. No-op (no rev bump) if already playing. */
export function play(anchor: PlaybackAnchor, now: number): PlaybackAnchor {
  if (anchor.status === 'playing') return anchor;
  return {
    ...anchor,
    status: 'playing',
    // positionMs already holds the banked offset (or 0 when idle) — re-anchor at `now`.
    updatedAtUtc: now,
    revision: anchor.revision + 1,
  };
}

/** Pause: bank elapsed time so the stored offset stays true. No-op if not playing. */
export function pause(anchor: PlaybackAnchor, now: number): PlaybackAnchor {
  if (anchor.status !== 'playing') return anchor;
  const banked = anchor.positionMs + (now - anchor.updatedAtUtc);
  return {
    ...anchor,
    status: 'paused',
    positionMs: Math.max(0, banked),
    updatedAtUtc: now,
    revision: anchor.revision + 1,
  };
}

/**
 * Make a queue item the current track, playing from the start. Used by auto-play
 * of the first track, host skip, and auto-next advance (Phase 6).
 */
export function playTrack(
  anchor: PlaybackAnchor,
  params: { itemId: string; videoId: string },
  now: number,
): PlaybackAnchor {
  return {
    ...anchor,
    currentTrackId: params.itemId,
    currentVideoId: params.videoId,
    status: 'playing',
    positionMs: 0,
    updatedAtUtc: now,
    revision: anchor.revision + 1,
  };
}

/** Drain to idle — no current track (queue empty / cleared). */
export function goIdle(anchor: PlaybackAnchor, now: number): PlaybackAnchor {
  return {
    ...anchor,
    currentTrackId: null,
    currentVideoId: null,
    status: 'idle',
    positionMs: 0,
    updatedAtUtc: now,
    revision: anchor.revision + 1,
  };
}

/** Seek: replace position at a new anchor; status is preserved. */
export function seek(anchor: PlaybackAnchor, positionMs: number, now: number): PlaybackAnchor {
  return {
    ...anchor,
    positionMs: Math.max(0, Math.trunc(positionMs)),
    updatedAtUtc: now,
    revision: anchor.revision + 1,
  };
}

// ── drift (Phase 3: calculate + classify only; no media seeking) ───────────
export type DriftBand = 'ignore' | 'soft' | 'hard';

export function computeDrift(playerPositionMs: number, expectedPositionMs: number): number {
  return playerPositionMs - expectedPositionMs;
}

export function classifyDrift(
  driftMs: number,
  thresholds: { ignoreMs: number; hardMs: number } = {
    ignoreMs: DRIFT_IGNORE_MS,
    hardMs: DRIFT_HARD_MS,
  },
): DriftBand {
  const abs = Math.abs(driftMs);
  if (abs < thresholds.ignoreMs) return 'ignore';
  if (abs <= thresholds.hardMs) return 'soft';
  return 'hard';
}
