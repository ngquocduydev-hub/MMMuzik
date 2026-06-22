import { create } from 'zustand';
import type { ParticipantDto } from '@/shared/types';

interface ParticipantsState {
  participants: ParticipantDto[];
  hydrate: (list: ParticipantDto[]) => void;
  upsert: (p: ParticipantDto) => void;
  remove: (sessionId: string) => void;
  setOnline: (sessionId: string, online: boolean) => void;
  setHost: (sessionId: string) => void;
  reset: () => void;
}

/** Keyed by sessionId; convergent ops so repeated events are idempotent. */
export const useParticipantsStore = create<ParticipantsState>((set) => ({
  participants: [],
  hydrate: (list) => set({ participants: list }),
  upsert: (p) =>
    set((s) => {
      const others = s.participants.filter((x) => x.sessionId !== p.sessionId);
      return { participants: [...others, p].sort((a, b) => a.joinedAt.localeCompare(b.joinedAt)) };
    }),
  remove: (sessionId) =>
    set((s) => ({ participants: s.participants.filter((p) => p.sessionId !== sessionId) })),
  setOnline: (sessionId, online) =>
    set((s) => ({
      participants: s.participants.map((p) =>
        p.sessionId === sessionId ? { ...p, isOnline: online } : p,
      ),
    })),
  setHost: (sessionId) =>
    set((s) => ({
      participants: s.participants.map((p) => ({
        ...p,
        role: p.sessionId === sessionId ? 'host' : 'member',
      })),
    })),
  reset: () => set({ participants: [] }),
}));
