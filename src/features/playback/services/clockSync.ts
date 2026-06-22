import type { ClientSocket } from '@/lib/socket-client';
import { offsetFromProbe, pickBestOffset } from '@/shared/domain/clock';
import { CLOCK_PING_SAMPLES } from '@/shared/constants';
import type { ClockSample } from '@/shared/types';

/** One ping/pong round → a clock sample (matched by t0). */
function onePing(socket: ClientSocket): Promise<ClockSample> {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const timer = setTimeout(() => {
      socket.off('system:pong', handler);
      reject(new Error('clock probe timed out'));
    }, 3_000);
    const handler = (p: { t0: number; serverEpochMs: number }) => {
      if (p.t0 !== t0) return;
      clearTimeout(timer);
      socket.off('system:pong', handler);
      resolve(offsetFromProbe({ t0, serverMs: p.serverEpochMs, t1: Date.now() }));
    };
    socket.on('system:pong', handler);
    socket.emit('system:ping', { t0 });
  });
}

/** Probe N times, keep the lowest-RTT sample (PLAYBACK §5). */
export async function measureClockOffset(
  socket: ClientSocket,
  samples = CLOCK_PING_SAMPLES,
): Promise<ClockSample | null> {
  const collected: ClockSample[] = [];
  for (let i = 0; i < samples; i++) {
    try {
      collected.push(await onePing(socket));
    } catch {
      /* skip a dropped probe */
    }
  }
  return pickBestOffset(collected);
}
