import { describe, it, expect, beforeEach } from 'vitest';
import { useChatStore } from '@/features/chat/store';
import type { ChatMessageDto } from '@/shared/types';

const msg = (over: Partial<ChatMessageDto> = {}): ChatMessageDto => ({
  id: 'm1',
  roomId: 'r1',
  sessionId: 's1',
  nickname: 'Anna',
  body: 'hi',
  sentAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

beforeEach(() => useChatStore.getState().reset());

describe('chatStore (convergent, dedupe-by-id — REALTIME §6.5)', () => {
  it('hydrate dedupes by id and orders oldest-first', () => {
    useChatStore.getState().hydrate([
      msg({ id: 'b', sentAt: '2026-01-01T00:02:00.000Z' }),
      msg({ id: 'a', sentAt: '2026-01-01T00:01:00.000Z' }),
      msg({ id: 'b', sentAt: '2026-01-01T00:02:00.000Z' }), // duplicate id
    ]);
    const list = useChatStore.getState().messages;
    expect(list.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('append ignores a repeat id (ack + broadcast deliver the same message)', () => {
    useChatStore.getState().append(msg({ id: 'x' }));
    useChatStore.getState().append(msg({ id: 'x', body: 'changed' }));
    const list = useChatStore.getState().messages;
    expect(list).toHaveLength(1);
    expect(list[0]!.body).toBe('hi'); // first write wins; the dupe is dropped
  });

  it('append keeps messages ordered by sentAt', () => {
    useChatStore.getState().append(msg({ id: 'late', sentAt: '2026-01-01T00:05:00.000Z' }));
    useChatStore.getState().append(msg({ id: 'early', sentAt: '2026-01-01T00:01:00.000Z' }));
    expect(useChatStore.getState().messages.map((m) => m.id)).toEqual(['early', 'late']);
  });

  it('pushSystem records ephemeral system events and reset clears them', () => {
    useChatStore.getState().pushSystem('Anna joined');
    useChatStore.getState().pushSystem('Khoa is now host');
    const events = useChatStore.getState().systemEvents;
    expect(events.map((e) => e.text)).toEqual(['Anna joined', 'Khoa is now host']);
    expect(events[0]!.id).not.toBe(events[1]!.id); // unique ids
    useChatStore.getState().reset();
    expect(useChatStore.getState().systemEvents).toHaveLength(0);
  });
});

describe('chatStore unread (Feature 2 — chat notifications)', () => {
  it('counts messages that arrive while chat is hidden', () => {
    useChatStore.getState().setChatVisible(false);
    useChatStore.getState().append(msg({ id: 'a' }));
    useChatStore.getState().append(msg({ id: 'b' }));
    expect(useChatStore.getState().unread).toBe(2);
  });

  it('does NOT count messages that arrive while chat is visible', () => {
    useChatStore.getState().setChatVisible(true);
    useChatStore.getState().append(msg({ id: 'a' }));
    useChatStore.getState().append(msg({ id: 'b' }));
    expect(useChatStore.getState().unread).toBe(0);
  });

  it('opening chat (becoming visible) clears the unread count', () => {
    useChatStore.getState().setChatVisible(false);
    useChatStore.getState().append(msg({ id: 'a' }));
    expect(useChatStore.getState().unread).toBe(1);
    useChatStore.getState().setChatVisible(true);
    expect(useChatStore.getState().unread).toBe(0);
  });

  it('a deduped (repeat-id) message does not bump unread', () => {
    useChatStore.getState().setChatVisible(false);
    useChatStore.getState().append(msg({ id: 'x' }));
    useChatStore.getState().append(msg({ id: 'x' })); // ack + broadcast → same id
    expect(useChatStore.getState().unread).toBe(1);
  });

  it('reset clears unread and visibility', () => {
    useChatStore.getState().setChatVisible(false);
    useChatStore.getState().append(msg({ id: 'a' }));
    useChatStore.getState().reset();
    expect(useChatStore.getState().unread).toBe(0);
    expect(useChatStore.getState().chatVisible).toBe(false);
  });
});
