import { describe, it, expect } from 'vitest';
import { createRoomSchema, roomVisibilitySchema } from '@/shared/validation';

describe('createRoomSchema visibility', () => {
  it('defaults visibility to public when omitted', () => {
    const parsed = createRoomSchema.parse({ name: 'Friday Vibes', nickname: 'DJ' });
    expect(parsed.visibility).toBe('public');
  });

  it('accepts an explicit private room', () => {
    const parsed = createRoomSchema.parse({
      name: 'Secret',
      nickname: 'DJ',
      visibility: 'private',
    });
    expect(parsed.visibility).toBe('private');
  });

  it('rejects an unknown visibility value', () => {
    expect(() => roomVisibilitySchema.parse('unlisted')).toThrow();
    expect(
      createRoomSchema.safeParse({ name: 'X', nickname: 'Y', visibility: 'unlisted' }).success,
    ).toBe(false);
  });
});
