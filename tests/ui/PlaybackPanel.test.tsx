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

describe('PlaybackPanel (video-only stage)', () => {
  it('shows just the video — no title / artist / sync / provider / hatch chrome', () => {
    render(<PlaybackPanel />);
    expect(screen.queryByText('Blinding Lights')).not.toBeInTheDocument();
    expect(screen.queryByText('The Weeknd')).not.toBeInTheDocument();
    expect(screen.queryByText('In sync')).not.toBeInTheDocument();
    expect(screen.queryByText('YouTube')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /open on youtube/i })).not.toBeInTheDocument();
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
