import { describe, it, expect } from 'vitest';
import {
  computeExpectedPosition,
  play,
  pause,
  seek,
  playTrack,
  goIdle,
  computeDrift,
  classifyDrift,
  type PlaybackAnchor,
} from '@/shared/domain/playback';

const base = (over: Partial<PlaybackAnchor> = {}): PlaybackAnchor => ({
  status: 'idle',
  currentTrackId: 'track-1',
  currentVideoId: null,
  positionMs: 0,
  updatedAtUtc: 1_000_000,
  revision: 0,
  ...over,
});

describe('computeExpectedPosition', () => {
  it('advances while playing by elapsed wall time', () => {
    const a = base({ status: 'playing', positionMs: 5_000, updatedAtUtc: 1_000_000 });
    expect(computeExpectedPosition(a, 1_003_000)).toBe(8_000); // +3s
  });

  it('is frozen while paused', () => {
    const a = base({ status: 'paused', positionMs: 5_000, updatedAtUtc: 1_000_000 });
    expect(computeExpectedPosition(a, 1_999_999)).toBe(5_000);
  });

  it('never returns negative', () => {
    const a = base({ status: 'playing', positionMs: 0, updatedAtUtc: 2_000_000 });
    expect(computeExpectedPosition(a, 1_000_000)).toBe(0);
  });
});

describe('play/pause banking (the invariant)', () => {
  it('play from idle anchors at now, bumps revision', () => {
    const next = play(base({ status: 'idle', positionMs: 0 }), 1_000_500);
    expect(next.status).toBe('playing');
    expect(next.positionMs).toBe(0);
    expect(next.updatedAtUtc).toBe(1_000_500);
    expect(next.revision).toBe(1);
  });

  it('pause banks elapsed into positionMs', () => {
    const playing = base({ status: 'playing', positionMs: 5_000, updatedAtUtc: 1_000_000 });
    const paused = pause(playing, 1_002_000); // +2s
    expect(paused.status).toBe('paused');
    expect(paused.positionMs).toBe(7_000);
    expect(paused.updatedAtUtc).toBe(1_002_000);
    expect(paused.revision).toBe(1);
  });

  it('play → pause → resume continues from the banked offset (no lost time)', () => {
    let a = base({ status: 'idle', positionMs: 0, updatedAtUtc: 1_000_000 });
    a = play(a, 1_000_000); // playing from 0 @ t=1_000_000
    a = pause(a, 1_010_000); // +10s → banked 10_000
    expect(a.positionMs).toBe(10_000);
    a = play(a, 1_050_000); // resume 40s later
    // expected position right at resume == banked offset (not advanced during pause)
    expect(computeExpectedPosition(a, 1_050_000)).toBe(10_000);
    expect(computeExpectedPosition(a, 1_055_000)).toBe(15_000); // +5s playing
  });

  it('play is idempotent (no-op, same reference, no revision bump) when already playing', () => {
    const playing = base({ status: 'playing', revision: 3 });
    expect(play(playing, 9_999)).toBe(playing);
  });

  it('pause is a no-op when not playing', () => {
    const paused = base({ status: 'paused', revision: 3 });
    expect(pause(paused, 9_999)).toBe(paused);
  });

  it('rapid play/pause toggling stays consistent', () => {
    let a = base({ status: 'idle', positionMs: 0, updatedAtUtc: 0 });
    a = play(a, 0);
    a = pause(a, 100);
    a = play(a, 100);
    a = pause(a, 250);
    expect(a.status).toBe('paused');
    expect(a.positionMs).toBe(250); // 100 + 150 banked across two playing spans
    expect(a.revision).toBe(4);
  });
});

describe('seek', () => {
  it('seek while playing re-anchors and keeps playing', () => {
    const playing = base({ status: 'playing', positionMs: 5_000, updatedAtUtc: 1_000_000 });
    const next = seek(playing, 60_000, 1_002_000);
    expect(next.status).toBe('playing');
    expect(next.positionMs).toBe(60_000);
    expect(next.updatedAtUtc).toBe(1_002_000);
    expect(computeExpectedPosition(next, 1_003_000)).toBe(61_000); // advances from seek target
  });

  it('seek while paused stays paused at the new position', () => {
    const paused = base({ status: 'paused', positionMs: 5_000 });
    const next = seek(paused, 30_000, 1_002_000);
    expect(next.status).toBe('paused');
    expect(computeExpectedPosition(next, 1_999_999)).toBe(30_000);
  });

  it('clamps negative seeks to 0 and truncates', () => {
    expect(seek(base(), -500, 1).positionMs).toBe(0);
    expect(seek(base(), 1234.9, 1).positionMs).toBe(1234);
  });
});

describe('playTrack / goIdle (queue transitions)', () => {
  it('playTrack makes an item current, playing from 0, bumps revision', () => {
    const next = playTrack(base({ status: 'idle' }), { itemId: 'q1', videoId: 'vid123' }, 5_000);
    expect(next.currentTrackId).toBe('q1');
    expect(next.currentVideoId).toBe('vid123');
    expect(next.status).toBe('playing');
    expect(next.positionMs).toBe(0);
    expect(next.updatedAtUtc).toBe(5_000);
    expect(next.revision).toBe(1);
  });

  it('goIdle clears current track + video', () => {
    const playing = base({
      status: 'playing',
      currentTrackId: 'q1',
      currentVideoId: 'v',
      positionMs: 9_000,
    });
    const next = goIdle(playing, 6_000);
    expect(next.status).toBe('idle');
    expect(next.currentTrackId).toBeNull();
    expect(next.currentVideoId).toBeNull();
    expect(next.positionMs).toBe(0);
    expect(next.revision).toBe(1);
  });
});

describe('drift classification (300 / 1000 bands)', () => {
  it('computeDrift = player - expected (signed)', () => {
    expect(computeDrift(10_500, 10_000)).toBe(500); // ahead
    expect(computeDrift(9_500, 10_000)).toBe(-500); // behind
  });

  it('< 300ms → ignore', () => {
    expect(classifyDrift(0)).toBe('ignore');
    expect(classifyDrift(299)).toBe('ignore');
    expect(classifyDrift(-299)).toBe('ignore');
  });

  it('300–1000ms → soft', () => {
    expect(classifyDrift(300)).toBe('soft');
    expect(classifyDrift(1000)).toBe('soft');
    expect(classifyDrift(-750)).toBe('soft');
  });

  it('> 1000ms → hard', () => {
    expect(classifyDrift(1001)).toBe('hard');
    expect(classifyDrift(-5000)).toBe('hard');
  });
});
