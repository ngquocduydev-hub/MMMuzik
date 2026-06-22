// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueueList } from '@/components/QueueList';
import { useRoomStore } from '@/features/room/store';
import { usePlaybackStore } from '@/features/playback/store';
import { useQueueStore } from '@/features/queue/store';
import type { QueueItemDto, RoomDto } from '@/shared/types';

const room: RoomDto = {
  id: 'r1',
  code: 'ABC234',
  name: 'Test',
  status: 'active',
  hostSessionId: 's-host',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const item = (over: Partial<QueueItemDto>): QueueItemDto => ({
  id: 'q1',
  roomId: 'r1',
  trackId: 't1',
  provider: 'youtube',
  videoId: 'dQw4w9WgXcQ',
  title: 'Song A',
  durationMs: 0,
  thumbnailUrl: null,
  position: 0,
  addedBySessionId: 's-host',
  addedByNickname: 'DJ',
  addedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

beforeEach(() => {
  useRoomStore.getState().reset();
  usePlaybackStore.getState().reset();
  useQueueStore.getState().reset();
  useRoomStore.getState().setRoom(room);
});

describe('QueueList', () => {
  it('renders items with count and added-by, highlighting the current', () => {
    useRoomStore.getState().setSession({ id: 's-guest', displayName: 'Guest', avatar: null });
    useQueueStore
      .getState()
      .hydrate([
        item({ id: 'q1', title: 'Song A', position: 0 }),
        item({ id: 'q2', title: 'Song B', position: 1, addedByNickname: 'Sam' }),
      ]);
    usePlaybackStore.setState({
      playback: {
        roomId: 'r1',
        status: 'playing',
        currentTrackId: 'q1',
        currentVideoId: 'dQw4w9WgXcQ',
        positionMs: 0,
        updatedAtUtc: Date.now(),
        revision: 1,
      },
      clockOffsetMs: 0,
      lastRttMs: 40,
    });
    render(<QueueList />);
    expect(screen.getByText('Song A')).toBeInTheDocument();
    expect(screen.getByText('Song B')).toBeInTheDocument();
    // "Up next" excludes the currently-playing track (Song A) → only Song B counts.
    expect(screen.getByText('1 up next')).toBeInTheDocument();
    expect(screen.getByText('Now playing')).toBeInTheDocument(); // current row subtitle
    expect(screen.getByText('added by Sam')).toBeInTheDocument();
    // Skip is available to EVERYONE now (collaborative) and enabled while a track plays.
    expect(screen.getByRole('button', { name: /skip current track/i })).toBeEnabled();
  });

  it('shows host controls (remove + skip) only for the host', () => {
    useRoomStore.getState().setSession({ id: 's-host', displayName: 'DJ', avatar: null });
    // q1 is current (drives Skip); q2 is queued (drives the removable row).
    useQueueStore
      .getState()
      .hydrate([
        item({ id: 'q1', title: 'Song A', position: 0 }),
        item({ id: 'q2', title: 'Song B', position: 1 }),
      ]);
    usePlaybackStore.setState({
      playback: {
        roomId: 'r1',
        status: 'playing',
        currentTrackId: 'q1',
        currentVideoId: 'dQw4w9WgXcQ',
        positionMs: 0,
        updatedAtUtc: Date.now(),
        revision: 1,
      },
      clockOffsetMs: 0,
      lastRttMs: 40,
    });
    render(<QueueList />);
    expect(screen.getByLabelText('Remove Song B from queue')).toBeInTheDocument();
    expect(screen.queryByLabelText('Remove Song A from queue')).not.toBeInTheDocument(); // current is pinned
    expect(screen.getByRole('button', { name: /skip current track/i })).toBeEnabled();
  });

  it('hides host-only remove for guests; Add-song + Skip are available to everyone', () => {
    useRoomStore.getState().setSession({ id: 's-guest', displayName: 'Guest', avatar: null });
    useQueueStore.getState().hydrate([item({ id: 'q2', title: 'Song B', position: 0 })]);
    render(<QueueList />);
    expect(screen.queryByLabelText('Remove Song B from queue')).not.toBeInTheDocument(); // remove stays host-only
    expect(screen.getByRole('button', { name: /add song/i })).toBeInTheDocument();
    // Skip is shown to guests too now (disabled here since nothing is playing).
    expect(screen.getByRole('button', { name: /skip current track/i })).toBeDisabled();
  });

  it('shows live position / duration for the current track only', () => {
    useRoomStore.getState().setSession({ id: 's-guest', displayName: 'Guest', avatar: null });
    useQueueStore.getState().hydrate([
      item({ id: 'q1', title: 'Song A', position: 0, durationMs: 1_653_000 }), // current → 27:33
      item({ id: 'q2', title: 'Song B', position: 1, durationMs: 255_000 }), // queued → 4:15
    ]);
    // paused → the computed position is frozen at the banked offset (deterministic)
    usePlaybackStore.setState({
      playback: {
        roomId: 'r1',
        status: 'paused',
        currentTrackId: 'q1',
        currentVideoId: 'dQw4w9WgXcQ',
        positionMs: 671_000, // 11:11
        updatedAtUtc: Date.now(),
        revision: 1,
      },
      clockOffsetMs: 0,
      lastRttMs: 40,
    });
    render(<QueueList />);
    expect(screen.getByText('11:11 / 27:33')).toBeInTheDocument(); // current: position / duration
    expect(screen.getByText('4:15')).toBeInTheDocument(); // queued: duration only
  });

  it('shows the empty state', () => {
    useRoomStore.getState().setSession({ id: 's-host', displayName: 'DJ', avatar: null });
    render(<QueueList />);
    expect(screen.getByText("Queue's empty")).toBeInTheDocument();
  });
});
