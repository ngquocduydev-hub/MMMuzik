import { create } from 'zustand';
import type { RoomDto, SessionDto } from '@/shared/types';

interface RoomState {
  room: RoomDto | null;
  session: SessionDto | null;
  isReady: boolean;
  closed: boolean;
  error: string | null;
  setRoom: (room: RoomDto) => void;
  setSession: (session: SessionDto) => void;
  setReady: (ready: boolean) => void;
  setClosed: (closed: boolean) => void;
  setError: (error: string | null) => void;
  setHost: (newHostSessionId: string) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  room: null,
  session: null,
  isReady: false,
  closed: false,
  error: null,
  setRoom: (room) => set({ room }),
  setSession: (session) => set({ session }),
  setReady: (isReady) => set({ isReady }),
  setClosed: (closed) => set({ closed }),
  setError: (error) => set({ error }),
  setHost: (newHostSessionId) =>
    set((s) => (s.room ? { room: { ...s.room, hostSessionId: newHostSessionId } } : {})),
  reset: () => set({ room: null, session: null, isReady: false, closed: false, error: null }),
}));
