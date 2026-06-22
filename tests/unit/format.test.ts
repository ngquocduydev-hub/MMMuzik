import { describe, it, expect } from 'vitest';
import { formatMs, formatTrackTime, splitTrackTitle } from '@/lib/format';

describe('formatMs', () => {
  it('formats ms as m:ss (seconds zero-padded)', () => {
    expect(formatMs(0)).toBe('0:00');
    expect(formatMs(30_000)).toBe('0:30');
    expect(formatMs(255_000)).toBe('4:15');
    expect(formatMs(1_653_000)).toBe('27:33');
  });
  it('clamps negatives to 0:00', () => {
    expect(formatMs(-5_000)).toBe('0:00');
  });
});

describe('formatTrackTime (Feature 3 — queue row time)', () => {
  it('non-current row shows duration only', () => {
    expect(formatTrackTime(null, 1_653_000)).toBe('27:33');
    expect(formatTrackTime(null, 255_000)).toBe('4:15');
  });

  it('non-current row with unknown duration shows --:--', () => {
    expect(formatTrackTime(null, 0)).toBe('--:--');
  });

  it('current row shows position / duration', () => {
    expect(formatTrackTime(671_000, 1_653_000)).toBe('11:11 / 27:33');
    expect(formatTrackTime(30_000, 255_000)).toBe('0:30 / 4:15');
  });

  it('clamps the position to the duration (never over-runs the total)', () => {
    expect(formatTrackTime(2_000_000, 1_653_000)).toBe('27:33 / 27:33');
    expect(formatTrackTime(85_000, 85_000)).toBe('1:25 / 1:25');
  });

  it('current row with unknown duration shows the live elapsed alone', () => {
    expect(formatTrackTime(30_000, 0)).toBe('0:30');
  });
});

describe('splitTrackTitle', () => {
  it('splits "Artist - Song"', () => {
    expect(splitTrackTitle('The Weeknd - Blinding Lights')).toEqual({
      primary: 'Blinding Lights',
      secondary: 'The Weeknd',
    });
  });
  it('keeps a title without a separator', () => {
    expect(splitTrackTitle('Lofi mix')).toEqual({ primary: 'Lofi mix', secondary: null });
  });
});
