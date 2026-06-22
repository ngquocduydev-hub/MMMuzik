// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ParticipantList } from '@/components/ParticipantList';
import { useParticipantsStore } from '@/features/participants/store';
import { useRoomStore } from '@/features/room/store';

beforeEach(() => {
  useParticipantsStore.getState().reset();
  useRoomStore.getState().reset();
});

describe('ParticipantList', () => {
  it('renders participants with host badge and online count', () => {
    useParticipantsStore.getState().hydrate([
      {
        sessionId: 's1',
        nickname: 'Anna',
        avatar: null,
        role: 'host',
        isOnline: true,
        joinedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        sessionId: 's2',
        nickname: 'Sam',
        avatar: null,
        role: 'member',
        isOnline: true,
        joinedAt: '2026-01-01T00:01:00.000Z',
      },
    ]);
    render(<ParticipantList />);
    expect(screen.getByText('Anna')).toBeInTheDocument();
    expect(screen.getByText('Sam')).toBeInTheDocument();
    expect(screen.getByText('Host')).toBeInTheDocument(); // HostBadge
    expect(screen.getByText('2 online')).toBeInTheDocument(); // Panel meta
  });

  it('shows the "alone" empty state when you are the only one', () => {
    useParticipantsStore.getState().hydrate([
      {
        sessionId: 's1',
        nickname: 'Anna',
        avatar: null,
        role: 'host',
        isOnline: true,
        joinedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    render(<ParticipantList />);
    expect(screen.getByText("You're the only one here")).toBeInTheDocument();
  });
});
