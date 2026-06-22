import { create } from 'zustand';
import type { PlaybackStateDto } from '@/shared/types';

interface PlaybackState {
  playback: PlaybackStateDto | null;
  clockOffsetMs: number;
  lastRttMs: number | null;
  /** Apply an anchor update — REJECTS stale revisions (anti-stale, PLAYBACK §2). */
  reconcile: (dto: PlaybackStateDto) => void;
  setClock: (offsetMs: number, rttMs: number) => void;
  reset: () => void;
}

export const usePlaybackStore = create<PlaybackState>((set) => ({
  playback: null,
  clockOffsetMs: 0,
  lastRttMs: null,
  reconcile: (dto) =>
    set((s) => {
      if (s.playback && dto.revision <= s.playback.revision) return {}; // stale → ignore
      return { playback: dto };
    }),
  setClock: (clockOffsetMs, lastRttMs) => set({ clockOffsetMs, lastRttMs }),
  reset: () => set({ playback: null, clockOffsetMs: 0, lastRttMs: null }),
}));
