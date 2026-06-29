// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PublicRoomDto } from '@/shared/types';

const listPublicRoomsMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/features/room/services/roomApi', () => ({
  listPublicRooms: () => listPublicRoomsMock(),
  // JoinRoomDialog (rendered on private cards) imports getRoomSummary from here.
  getRoomSummary: vi.fn(),
}));

import { RoomBrowser } from '@/components/room/RoomBrowser';

const publicRoom: PublicRoomDto = {
  id: 'r1',
  code: 'ABC234',
  name: 'Friday Vibes',
  visibility: 'public',
  listenerCount: 3,
  nowPlayingTitle: 'Blinding Lights',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const privateRoom: PublicRoomDto = {
  id: 'r2',
  code: null, // withheld for private rooms
  name: 'Secret Set',
  visibility: 'private',
  listenerCount: 1,
  nowPlayingTitle: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  listPublicRoomsMock.mockReset();
});

describe('RoomBrowser', () => {
  it('renders a public room with now-playing and a one-click Join button', async () => {
    listPublicRoomsMock.mockResolvedValue({ rooms: [publicRoom] });
    render(<RoomBrowser />);

    expect(await screen.findByText('Friday Vibes')).toBeInTheDocument();
    expect(screen.getByText('Blinding Lights')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /join room/i })).toBeInTheDocument();
  });

  it('renders a private room as locked with a "Join with code" action', async () => {
    listPublicRoomsMock.mockResolvedValue({ rooms: [privateRoom] });
    render(<RoomBrowser />);

    expect(await screen.findByText('Secret Set')).toBeInTheDocument();
    expect(screen.getByText(/private — enter the code/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /join with code/i })).toBeInTheDocument();
    // No one-click join for a private room.
    expect(screen.queryByRole('button', { name: /^join room$/i })).not.toBeInTheDocument();
  });

  it('shows the empty state when no rooms exist', async () => {
    listPublicRoomsMock.mockResolvedValue({ rooms: [] });
    render(<RoomBrowser />);

    expect(await screen.findByText(/no rooms yet/i)).toBeInTheDocument();
  });
});
