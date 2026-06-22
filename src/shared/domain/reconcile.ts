import { classifyDrift } from './playback';
import { SEEK_COOLDOWN_MS } from '../constants';

/**
 * Pure renderer reconciliation decision — WHEN to re-align a media player to the
 * server timeline. Consumes the Phase-3 `classifyDrift` (no new sync logic):
 * tolerate drift below threshold, re-align only above it, never while buffering,
 * and rate-limit hard seeks (anti-thrash, PLAYBACK §8.4).
 */
export type PlayerPhase = 'unstarted' | 'ended' | 'playing' | 'paused' | 'buffering' | 'cued';

export function shouldHardSeek(opts: {
  driftMs: number;
  playerPhase: PlayerPhase;
  msSinceLastSeek: number;
}): boolean {
  const { driftMs, playerPhase, msSinceLastSeek } = opts;
  // Player readings are unreliable while not steadily playing/paused.
  if (playerPhase === 'buffering' || playerPhase === 'unstarted' || playerPhase === 'cued') {
    return false;
  }
  if (msSinceLastSeek < SEEK_COOLDOWN_MS) return false;
  return classifyDrift(driftMs) === 'hard';
}
