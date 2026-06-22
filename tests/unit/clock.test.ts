import { describe, it, expect } from 'vitest';
import { offsetFromProbe, pickBestOffset, serverNow } from '@/shared/domain/clock';

describe('clock offset (NTP-style)', () => {
  it('computes rtt and offset from a probe', () => {
    // client sends at 1000, server is +500 ahead, symmetric 100ms rtt
    const probe = { t0: 1000, serverMs: 1550, t1: 1100 };
    const s = offsetFromProbe(probe);
    expect(s.rttMs).toBe(100);
    expect(s.offsetMs).toBe(500); // 1550 - (1000 + 50)
  });

  it('serverNow = localNow + offset', () => {
    expect(serverNow(1000, 500)).toBe(1500);
  });
});

describe('pickBestOffset (lowest-RTT sample wins)', () => {
  it('returns the minimum-RTT sample', () => {
    const best = pickBestOffset([
      { rttMs: 120, offsetMs: 20 },
      { rttMs: 42, offsetMs: 36 },
      { rttMs: 80, offsetMs: 31 },
    ]);
    expect(best).toEqual({ rttMs: 42, offsetMs: 36 });
  });

  it('returns null for no samples', () => {
    expect(pickBestOffset([])).toBeNull();
  });
});
