import { describe, it, expect, beforeEach } from 'vitest';
import { useQueueActivityStore, describeAdders } from '@/features/queue/activityStore';

// QUEUE_ACTIVITY_TTL_MS = 3000 → expiry = now + 3000. `now` is injected for determinism.
describe('queue activity store', () => {
  beforeEach(() => useQueueActivityStore.getState().reset());

  it('ping records a session with a future expiry', () => {
    useQueueActivityStore.getState().ping('s1', 1000);
    expect(useQueueActivityStore.getState().active.s1).toBe(4000);
  });

  it('repeated ping extends the expiry (convergent, not additive)', () => {
    useQueueActivityStore.getState().ping('s1', 0);
    useQueueActivityStore.getState().ping('s1', 1000);
    expect(useQueueActivityStore.getState().active).toEqual({ s1: 4000 });
  });

  it('prune drops only expired entries', () => {
    useQueueActivityStore.getState().ping('s1', 0); // expires 3000
    useQueueActivityStore.getState().ping('s2', 5000); // expires 8000
    useQueueActivityStore.getState().prune(4000);
    const { active } = useQueueActivityStore.getState();
    expect(active.s1).toBeUndefined();
    expect(active.s2).toBe(8000);
  });

  it('reset clears everything', () => {
    useQueueActivityStore.getState().ping('s1', 0);
    useQueueActivityStore.getState().reset();
    expect(useQueueActivityStore.getState().active).toEqual({});
  });
});

describe('describeAdders', () => {
  it('phrases the cue by count', () => {
    expect(describeAdders([])).toBe('');
    expect(describeAdders(['Maya'])).toBe('Maya is adding a song…');
    expect(describeAdders(['Maya', 'Alex'])).toBe('Maya & Alex are adding songs…');
    expect(describeAdders(['Maya', 'Alex', 'Sam'])).toBe('Maya & 2 others are adding songs…');
  });
});
