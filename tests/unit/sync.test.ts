import { describe, it, expect } from 'vitest';
import { classifySyncHealth } from '@/shared/domain/sync';

describe('classifySyncHealth (visualization only)', () => {
  it('good under 150ms rtt', () => {
    expect(classifySyncHealth(0)).toBe('good');
    expect(classifySyncHealth(149)).toBe('good');
  });
  it('unstable 150–400ms', () => {
    expect(classifySyncHealth(150)).toBe('unstable');
    expect(classifySyncHealth(399)).toBe('unstable');
  });
  it('bad at/over 400ms or unknown', () => {
    expect(classifySyncHealth(400)).toBe('bad');
    expect(classifySyncHealth(null)).toBe('bad');
  });
});
