import { describe, it, expect } from 'vitest';
import { shouldHardSeek } from '@/shared/domain/reconcile';

const PAST_COOLDOWN = 5_000; // > SEEK_COOLDOWN_MS

describe('shouldHardSeek (renderer re-align decision)', () => {
  it('re-aligns when drift is hard, playing, and past cooldown', () => {
    expect(
      shouldHardSeek({ driftMs: 2_000, playerPhase: 'playing', msSinceLastSeek: PAST_COOLDOWN }),
    ).toBe(true);
  });

  it('tolerates drift within threshold (no seek)', () => {
    expect(
      shouldHardSeek({ driftMs: 250, playerPhase: 'playing', msSinceLastSeek: PAST_COOLDOWN }),
    ).toBe(false);
    expect(
      shouldHardSeek({ driftMs: 800, playerPhase: 'playing', msSinceLastSeek: PAST_COOLDOWN }),
    ).toBe(false); // soft band → tolerate for YouTube
  });

  it('never seeks while buffering / unstarted / cued', () => {
    for (const phase of ['buffering', 'unstarted', 'cued'] as const) {
      expect(
        shouldHardSeek({ driftMs: 5_000, playerPhase: phase, msSinceLastSeek: PAST_COOLDOWN }),
      ).toBe(false);
    }
  });

  it('respects the seek cooldown (anti-thrash)', () => {
    expect(shouldHardSeek({ driftMs: 5_000, playerPhase: 'playing', msSinceLastSeek: 500 })).toBe(
      false,
    );
  });
});
