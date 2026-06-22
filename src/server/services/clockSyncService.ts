/**
 * ClockSyncService — the server side of clock synchronization.
 *
 * The server is the authoritative clock. It simply stamps the current epoch ms
 * on a ping; the OFFSET/latency math (multiple samples, lowest-RTT wins) is a
 * client responsibility implemented with the pure helpers in
 * `@/shared/domain/clock` (offsetFromProbe / pickBestOffset / serverNow).
 */
export function serverNowMs(): number {
  return Date.now();
}

/** Build the pong payload echoing the client's t0 for its RTT calculation. */
export function buildPong(t0: number): { t0: number; serverEpochMs: number } {
  return { t0, serverEpochMs: serverNowMs() };
}
