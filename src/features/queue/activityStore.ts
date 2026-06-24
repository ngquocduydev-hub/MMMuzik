'use client';

import { useCallback, useEffect, useRef } from 'react';
import { create } from 'zustand';
import { getSocket } from '@/lib/socket-client';
import { QUEUE_ACTIVITY_TTL_MS, QUEUE_ACTIVITY_MIN_INTERVAL_MS } from '@/shared/constants';
import { useParticipantsStore } from '@/features/participants/store';
import { useRoomStore } from '@/features/room/store';

/**
 * Ephemeral "who's adding a song" cue (Phase 5). Keyed by sessionId → expiry epoch
 * ms; convergent (repeated pings just extend the expiry) and never persisted. The
 * realtime layer calls `ping` on each `presence:adding`; the UI prunes + resolves
 * nicknames from the participants store. `now` is injectable for deterministic tests.
 */
interface QueueActivityState {
  /** sessionId → expiresAt (epoch ms). */
  active: Record<string, number>;
  ping: (sessionId: string, now?: number) => void;
  prune: (now?: number) => void;
  reset: () => void;
}

export const useQueueActivityStore = create<QueueActivityState>((set) => ({
  active: {},
  ping: (sessionId, now = Date.now()) =>
    set((s) => ({ active: { ...s.active, [sessionId]: now + QUEUE_ACTIVITY_TTL_MS } })),
  prune: (now = Date.now()) =>
    set((s) => {
      const next: Record<string, number> = {};
      let changed = false;
      for (const [sid, exp] of Object.entries(s.active)) {
        if (exp > now) next[sid] = exp;
        else changed = true;
      }
      return changed ? { active: next } : s;
    }),
  reset: () => set({ active: {} }),
}));

/**
 * Returns the nicknames currently "adding a song" (excluding me), auto-expiring.
 * Schedules a single timeout to the soonest expiry so it re-renders exactly when a
 * cue should disappear — no always-on interval.
 */
export function useWhoIsAdding(): string[] {
  const active = useQueueActivityStore((s) => s.active);
  const prune = useQueueActivityStore((s) => s.prune);
  const participants = useParticipantsStore((s) => s.participants);
  const mySessionId = useRoomStore((s) => s.session?.id ?? null);

  useEffect(() => {
    const exps = Object.values(active);
    if (exps.length === 0) return;
    const delay = Math.max(0, Math.min(...exps) - Date.now()) + 50;
    const id = setTimeout(() => prune(), delay);
    return () => clearTimeout(id);
  }, [active, prune]);

  const now = Date.now();
  return Object.entries(active)
    .filter(([sid, exp]) => exp > now && sid !== mySessionId)
    .map(([sid]) => participants.find((p) => p.sessionId === sid)?.nickname)
    .filter((n): n is string => !!n);
}

/**
 * A debounced emitter for the local user's "I'm adding/searching" signal. Call on
 * meaningful intent (open search, submit, click Add); throttled client-side so a
 * burst of clicks sends at most one ping per interval.
 */
export function useActivityPing(): (roomId: string | null) => void {
  const last = useRef(0);
  return useCallback((roomId: string | null) => {
    if (!roomId) return;
    const now = Date.now();
    if (now - last.current < QUEUE_ACTIVITY_MIN_INTERVAL_MS) return;
    last.current = now;
    getSocket().emit('queue:activity', { roomId });
  }, []);
}

/** Human phrasing for the cue: "Maya is adding…", "Maya & Alex are adding…". */
export function describeAdders(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return `${names[0]} is adding a song…`;
  if (names.length === 2) return `${names[0]} & ${names[1]} are adding songs…`;
  return `${names[0]} & ${names.length - 1} others are adding songs…`;
}
