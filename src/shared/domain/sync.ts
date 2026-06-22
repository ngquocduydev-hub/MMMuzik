/**
 * Pure sync-health classification — VISUALIZATION only (no correction logic).
 * Derived from the round-trip latency of the clock probe.
 */
export type SyncHealth = 'good' | 'unstable' | 'bad';

export function classifySyncHealth(rttMs: number | null): SyncHealth {
  if (rttMs === null) return 'bad';
  if (rttMs < 150) return 'good';
  if (rttMs < 400) return 'unstable';
  return 'bad';
}
