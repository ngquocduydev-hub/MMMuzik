import type { ClockSample } from '../types';

/**
 * Pure NTP-style clock-offset math (PLAYBACK_ENGINE §5). The server is the
 * authority; each client estimates an offset so `serverNow = localNow + offset`.
 */
export interface ClockProbe {
  t0: number; // client send time (local epoch ms)
  serverMs: number; // server epoch ms stamped on receipt
  t1: number; // client receive time (local epoch ms)
}

export function offsetFromProbe(probe: ClockProbe): ClockSample {
  const rttMs = probe.t1 - probe.t0;
  const offsetMs = probe.serverMs - (probe.t0 + rttMs / 2);
  return { rttMs, offsetMs };
}

/** Lowest-latency (min-RTT) sample wins — least jitter / most symmetric path. */
export function pickBestOffset(samples: readonly ClockSample[]): ClockSample | null {
  if (samples.length === 0) return null;
  return samples.reduce((best, s) => (s.rttMs < best.rttMs ? s : best));
}

export function serverNow(localNowMs: number, offsetMs: number): number {
  return localNowMs + offsetMs;
}
