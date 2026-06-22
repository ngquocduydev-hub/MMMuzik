'use client';

import { useEffect, useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { formatMs } from '@/lib/format';

/**
 * Accessible seek bar + timestamps. While the host drags, a local value tracks
 * the thumb; it resets shortly after the authoritative server position updates
 * so the bar follows playback. Seek is committed (one server command), never on
 * every drag tick. Guests get a disabled, read-only bar.
 */
export function PlaybackProgress({
  positionMs,
  durationMs,
  canSeek,
  onSeek,
}: {
  positionMs: number;
  durationMs: number;
  canSeek: boolean;
  onSeek: (ms: number) => void;
}) {
  const [dragging, setDragging] = useState<number | null>(null);

  useEffect(() => {
    if (dragging === null) return;
    const t = setTimeout(() => setDragging(null), 400);
    return () => clearTimeout(t);
  }, [positionMs, dragging]);

  const value = dragging ?? positionMs;

  return (
    <div>
      <Slider
        value={[value]}
        max={durationMs || 1}
        step={1000}
        disabled={!canSeek}
        aria-label="Seek"
        onValueChange={([v]) => setDragging(v ?? 0)}
        onValueCommit={([v]) => onSeek(v ?? 0)}
      />
      <div className="mt-1.5 flex justify-between font-mono text-xs tabular-nums text-muted-foreground">
        <span className="text-foreground">{formatMs(value)}</span>
        <span>{durationMs > 0 ? formatMs(durationMs) : '--:--'}</span>
      </div>
    </div>
  );
}
