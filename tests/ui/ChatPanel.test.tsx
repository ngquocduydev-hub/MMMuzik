// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatPanel } from '@/components/ChatPanel';
import { useRoomStore } from '@/features/room/store';
import { useChatStore } from '@/features/chat/store';
import type { ChatMessageDto, RoomDto } from '@/shared/types';

const room: RoomDto = {
  id: 'r1',
  code: 'ABC234',
  name: 'Test',
  status: 'active',
  hostSessionId: 's-host',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const msg = (over: Partial<ChatMessageDto>): ChatMessageDto => ({
  id: 'm1',
  roomId: 'r1',
  sessionId: 's-other',
  nickname: 'Anna',
  body: 'hi there',
  sentAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

beforeEach(() => {
  useRoomStore.getState().reset();
  useChatStore.getState().reset();
  useRoomStore.getState().setRoom(room);
});

describe('ChatPanel', () => {
  it('renders messages, shows the sender name on others, and hides it on own messages', () => {
    useRoomStore.getState().setSession({ id: 's-me', displayName: 'Me', avatar: null });
    useChatStore
      .getState()
      .hydrate([
        msg({ id: 'a', sessionId: 's-other', nickname: 'Anna', body: 'first message' }),
        msg({
          id: 'b',
          sessionId: 's-me',
          nickname: 'Me',
          body: 'my reply',
          sentAt: '2026-01-01T00:01:00.000Z',
        }),
      ]);
    render(<ChatPanel />);
    expect(screen.getByText('first message')).toBeInTheDocument();
    expect(screen.getByText('my reply')).toBeInTheDocument();
    expect(screen.getByText('Anna')).toBeInTheDocument(); // sender name (others only)
    expect(screen.getByPlaceholderText('Message the room…')).toBeInTheDocument();
  });

  it('shows an empty state and a disabled send button when there is nothing to send', () => {
    useRoomStore.getState().setSession({ id: 's-me', displayName: 'Me', avatar: null });
    render(<ChatPanel />);
    expect(screen.getByText('No messages yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  });

  it('renders presence/host changes as system chips merged into the stream', () => {
    useRoomStore.getState().setSession({ id: 's-me', displayName: 'Me', avatar: null });
    useChatStore.getState().hydrate([msg({ id: 'a', body: 'hello' })]);
    useChatStore.getState().pushSystem('Khoa joined');
    render(<ChatPanel />);
    expect(screen.getByText('hello')).toBeInTheDocument();
    expect(screen.getByText('Khoa joined')).toBeInTheDocument(); // system chip, not a toast
  });
});
