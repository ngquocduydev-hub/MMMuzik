'use client';

import { Music2, X } from 'lucide-react';
import type { QueueItemDto } from '@/shared/types';
import { SoundBars } from '@/components/feedback/SoundBars';
import { Button } from '@/components/ui/button';
import { useExpectedPosition } from '@/features/playback/hooks/useExpectedPosition';
import { formatTrackTime, splitTrackTitle } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * One queue row (V1 §7.2–7.4). Index / now-playing equalizer · thumbnail ·
 * title+subline · duration · host-only remove "X" (hover-revealed). The current
 * track is highlighted, pinned, and never removable (the host skips it instead).
 * V1 exposes NO reorder UI — new songs always append to the tail.
 */
export function QueueItem({
  item,
  index,
  isCurrent,
  canEdit,
  onRemove,
}: {
  item: QueueItemDto;
  index: number;
  isCurrent: boolean;
  canEdit: boolean;
  onRemove: () => void;
}) {
  const { primary, secondary } = splitTrackTitle(item.title);
  return (
    <div
      className={cn(
        'group flex animate-slide-in items-center gap-3 rounded-xl px-2 py-2 transition-colors',
        isCurrent ? 'bg-primary/10 ring-1 ring-inset ring-primary/30' : 'hover:bg-surface-2',
      )}
    >
      <div className="flex w-5 shrink-0 items-center justify-center">
        {isCurrent ? (
          <SoundBars className="text-primary" />
        ) : (
          <span className="text-xs tabular-nums text-muted-foreground">{index + 1}</span>
        )}
      </div>

      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-surface-2">
        {item.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-muted-foreground">
            <Music2 className="h-4 w-4" />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-sm font-medium',
            isCurrent ? 'text-primary' : 'text-foreground',
          )}
        >
          {primary}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {isCurrent
            ? 'Now playing'
            : `${secondary ? `${secondary} · ` : ''}added by ${item.addedByNickname}`}
        </p>
      </div>

      {isCurrent ? (
        <CurrentTrackTime durationMs={item.durationMs} />
      ) : (
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {formatTrackTime(null, item.durationMs)}
        </span>
      )}

      {/* Reserve the action slot on every host row — including the pinned current
          track (which has no remove button) — so the duration column lines up
          across all rows instead of the current track's length sitting further right. */}
      {canEdit && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center">
          {!isCurrent && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onRemove}
              aria-label={`Remove ${item.title} from queue`}
              className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Live "position / duration" for the currently-playing row (Feature 3). Reuses the
 * shared, server-authoritative expected-position tick (`useExpectedPosition`, which
 * derives from the anchor + clock offset — NEVER the local player clock), so the
 * readout stays synchronized across all clients. Isolated in its own component so
 * only the current row re-renders on each tick, not the whole list.
 */
function CurrentTrackTime({ durationMs }: { durationMs: number }) {
  const positionMs = useExpectedPosition();
  return (
    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
      {formatTrackTime(positionMs, durationMs)}
    </span>
  );
}
