import { create } from 'zustand';
import type { QueueItemDto } from '@/shared/types';

interface QueueState {
  items: QueueItemDto[];
  /** Full-snapshot replace — the server's queue:updated is authoritative. */
  hydrate: (items: QueueItemDto[]) => void;
  reset: () => void;
}

/** No client-side mutation — the queue is only ever set from server snapshots. */
export const useQueueStore = create<QueueState>((set) => ({
  items: [],
  hydrate: (items) => set({ items: [...items].sort((a, b) => a.position - b.position) }),
  reset: () => set({ items: [] }),
}));
