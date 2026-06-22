// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlaybackPanel } from '@/components/PlaybackPanel';
import { useRoomStore } from '@/features/room/store';
import { usePlaybackStore } from '@/features/playback/store';
import { useQueueStore } from '@/features/queue/store';
import type { RoomDto, QueueItemDto } from '@/shared/types';

const room: RoomDto = {
  id: 'r1',
  code: 'ABC234',
  name: 'Test Room',
  status: 'active',
  hostSessionId: 's-host',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const track: QueueItemDto = {
  id: 'q1',
  roomId: 'r1',
  trackId: 't1',
  provider: 'youtube',
  videoId: 'dQw4w9WgXcQ',
  title: 'The Weeknd - Blinding Lights',
  durationMs: 200_000,
  thumbnailUrl: null,
  position: 0,
  addedBySessionId: 's-host',
  addedByNickname: 'DJ',
  addedAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  useRoomStore.getState().reset();
  usePlaybackStore.getState().reset();
  useQueueStore.getState().reset();
  useRoomStore.getState().setRoom(room);
  useRoomStore.getState().setSession({ id: 's-guest', displayName: 'Guest', avatar: null });
  useQueueStore.getState().hydrate([track]);
  // paused so nothing animates and the position is frozen/deterministic
  usePlaybackStore.setState({
    playback: {
      roomId: 'r1',
      status: 'paused',
      currentTrackId: 'q1',
      currentVideoId: 'dQw4w9WgXcQ',
      positionMs: 30_000,
      updatedAtUtc: Date.now(),
      revision: 2,
    },
    clockOffsetMs: 0,
    lastRttMs: 40,
  });
});

describe('PlaybackPanel (V1 native-controls model)', () => {
  it('renders the resolved track metadata + provider badge + the sync indicator', () => {
    render(<PlaybackPanel />);
    expect(screen.getByText('Blinding Lights')).toBeInTheDocument(); // split title
    expect(screen.getByText('The Weeknd')).toBeInTheDocument(); // split artist
    expect(screen.getByText('YouTube')).toBeInTheDocument(); // provider badge
    expect(screen.getByText('In sync')).toBeInTheDocument(); // sync health (rtt 40 → good)
  });

  it('always offers the YouTube escape hatch (no custom transport bar in V1)', () => {
    render(<PlaybackPanel />);
    expect(screen.getByRole('link', { name: /open on youtube/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    // V1 has no custom transport: there is no Play button rendered by the card.
    expect(screen.queryByRole('button', { name: 'Play' })).not.toBeInTheDocument();
  });

  it('shows the "Nothing playing" empty state when idle', () => {
    usePlaybackStore.setState({
      playback: {
        roomId: 'r1',
        status: 'idle',
        currentTrackId: null,
        currentVideoId: null,
        positionMs: 0,
        updatedAtUtc: Date.now(),
        revision: 3,
      },
    });
    render(<PlaybackPanel />);
    expect(screen.getByText('Nothing playing')).toBeInTheDocument();
  });
});
