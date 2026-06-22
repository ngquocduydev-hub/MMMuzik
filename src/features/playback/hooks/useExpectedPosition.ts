'use client';

import { useEffect, useState } from 'react';
import { usePlaybackStore } from '@/features/playback/store';
import { computeExpectedPosition } from '@/shared/domain/playback';

/**
 * Server-driven timeline tick. Computes the expected position every 250ms from
 * the authoritative anchor + clock offset — NEVER local time as truth
 * (PLAYBACK §4). Local component state only, so the tick doesn't write the
 * global store (keeps re-renders scoped).
 */
export function useExpectedPosition(): number {
  const playback = usePlaybackStore((s) => s.playback);
  const offsetMs = usePlaybackStore((s) => s.clockOffsetMs);
  const [positionMs, setPositionMs] = useState(0);

  useEffect(() => {
    if (!playback) {
      setPositionMs(0);
      return;
    }
    const tick = () => {
      const serverNow = Date.now() + offsetMs;
      setPositionMs(computeExpectedPosition(playback, serverNow));
    };
    tick();
    if (playback.status !== 'playing') return; // paused/idle: frozen, no interval
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [playback, offsetMs]);

  return positionMs;
}
