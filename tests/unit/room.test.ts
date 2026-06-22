import { describe, it, expect } from 'vitest';
import { generateRoomCode, dedupeNickname, isHost } from '@/shared/domain/room';
import { ROOM_CODE_ALPHABET } from '@/shared/constants';

describe('generateRoomCode', () => {
  it('is 6 chars from the human-friendly alphabet (no I L O 0 1)', () => {
    const code = generateRoomCode(() => 0.5);
    expect(code).toHaveLength(6);
    for (const ch of code) expect(ROOM_CODE_ALPHABET).toContain(ch);
    expect(code).not.toMatch(/[ILO01]/);
  });

  it('is deterministic given a seeded rng', () => {
    const makeRng = () => {
      const seq = [0, 0.999999, 0.5, 0.25, 0.75, 0.1];
      let i = 0;
      return () => seq[i++ % seq.length]!;
    };
    expect(generateRoomCode(makeRng())).toBe(generateRoomCode(makeRng()));
  });
});

describe('dedupeNickname (FR-2.4)', () => {
  it('returns the name unchanged when free', () => {
    expect(dedupeNickname('Duy', ['Anna'])).toBe('Duy');
  });
  it('appends (2), (3) on collision', () => {
    expect(dedupeNickname('Duy', ['Duy'])).toBe('Duy (2)');
    expect(dedupeNickname('Duy', ['Duy', 'Duy (2)'])).toBe('Duy (3)');
  });
});

describe('isHost', () => {
  it('true only for the matching host session', () => {
    const room = { hostSessionId: 's1' };
    expect(isHost(room, 's1')).toBe(true);
    expect(isHost(room, 's2')).toBe(false);
    expect(isHost(room, null)).toBe(false);
  });
});
