import { describe, it, expect, beforeEach } from 'vitest';
import { usePlaybackStore } from '@/features/playback/store';
import { useParticipantsStore } from '@/features/participants/store';
import { useRoomStore } from '@/features/room/store';
import type { PlaybackStateDto, ParticipantDto, RoomDto } from '@/shared/types';

const anchor = (over: Partial<PlaybackStateDto> = {}): PlaybackStateDto => ({
  roomId: 'r1',
  status: 'playing',
  currentTrackId: null,
  currentVideoId: null,
  positionMs: 0,
  updatedAtUtc: 1_000,
  revision: 1,
  ...over,
});

const participant = (over: Partial<ParticipantDto> = {}): ParticipantDto => ({
  sessionId: 's1',
  nickname: 'A',
  avatar: null,
  role: 'member',
  isOnline: true,
  joinedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

beforeEach(() => {
  usePlaybackStore.getState().reset();
  useParticipantsStore.getState().reset();
  useRoomStore.getState().reset();
});

describe('playbackStore.reconcile (anti-stale revision gating)', () => {
  it('accepts a newer revision', () => {
    usePlaybackStore.getState().reconcile(anchor({ revision: 1 }));
    usePlaybackStore.getState().reconcile(anchor({ revision: 2, positionMs: 500 }));
    expect(usePlaybackStore.getState().playback?.revision).toBe(2);
    expect(usePlaybackStore.getState().playback?.positionMs).toBe(500);
  });
  it('rejects a stale or equal revision', () => {
    usePlaybackStore.getState().reconcile(anchor({ revision: 5, positionMs: 999 }));
    usePlaybackStore.getState().reconcile(anchor({ revision: 5, positionMs: 0 }));
    usePlaybackStore.getState().reconcile(anchor({ revision: 3, positionMs: 0 }));
    expect(usePlaybackStore.getState().playback?.revision).toBe(5);
    expect(usePlaybackStore.getState().playback?.positionMs).toBe(999);
  });
});

describe('participantsStore (convergent, id-keyed)', () => {
  it('upsert is idempotent by sessionId', () => {
    useParticipantsStore.getState().upsert(participant({ sessionId: 's1' }));
    useParticipantsStore.getState().upsert(participant({ sessionId: 's1', nickname: 'A2' }));
    const list = useParticipantsStore.getState().participants;
    expect(list).toHaveLength(1);
    expect(list[0]!.nickname).toBe('A2');
  });
  it('remove + setOnline + setHost', () => {
    useParticipantsStore
      .getState()
      .hydrate([
        participant({ sessionId: 's1', joinedAt: '2026-01-01T00:00:00.000Z' }),
        participant({ sessionId: 's2', joinedAt: '2026-01-01T00:01:00.000Z' }),
      ]);
    useParticipantsStore.getState().setOnline('s2', false);
    useParticipantsStore.getState().setHost('s2');
    const byId = Object.fromEntries(
      useParticipantsStore.getState().participants.map((p) => [p.sessionId, p]),
    );
    expect(byId.s2!.isOnline).toBe(false);
    expect(byId.s2!.role).toBe('host');
    expect(byId.s1!.role).toBe('member');
    useParticipantsStore.getState().remove('s1');
    expect(useParticipantsStore.getState().participants).toHaveLength(1);
  });
});

describe('roomStore.setHost', () => {
  it('updates the room host pointer', () => {
    const room: RoomDto = {
      id: 'r1',
      code: 'ABC123',
      name: 'T',
      status: 'active',
      visibility: 'public',
      hostSessionId: 's1',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    useRoomStore.getState().setRoom(room);
    useRoomStore.getState().setHost('s2');
    expect(useRoomStore.getState().room?.hostSessionId).toBe('s2');
  });
});
