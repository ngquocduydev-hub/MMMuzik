'use client';

import { Music2, Plus, Check, Radio, Ban } from 'lucide-react';
import type { SearchResultDto } from '@/shared/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatMs, formatViewCount } from '@/lib/format';

export type AddState = 'idle' | 'adding' | 'added';

/**
 * One search result (Phase 3). Mirrors the queue row: thumbnail · title · channel +
 * duration + views · action. Un-addable results (livestream / can't-play) are
 * flagged and their Add is disabled — the server still re-guards on the real add,
 * so this is a UX hint, not the authority. `inQueue` surfaces a soft duplicate cue.
 */
export function SearchResultCard({
  result,
  inQueue,
  addState,
  onAdd,
}: {
  result: SearchResultDto;
  inQueue: boolean;
  addState: AddState;
  onAdd: () => void;
}) {
  const { title, channelTitle, thumbnailUrl, durationMs, viewCount, addable, isLivestream } =
    result;

  const meta = [
    channelTitle || null,
    !isLivestream && durationMs > 0 ? formatMs(durationMs) : null,
    viewCount != null ? `${formatViewCount(viewCount)} views` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-2">
      <div className="relative h-10 w-14 shrink-0 overflow-hidden rounded-lg bg-surface-2">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-muted-foreground">
            <Music2 className="h-4 w-4" />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{meta}</p>
      </div>

      {!addable ? (
        <Badge variant="secondary" className="shrink-0">
          {isLivestream ? (
            <>
              <Radio className="h-3 w-3" /> Live
            </>
          ) : (
            <>
              <Ban className="h-3 w-3" /> Can&apos;t play
            </>
          )}
        </Badge>
      ) : addState === 'added' ? (
        <Badge variant="success" className="shrink-0">
          <Check className="h-3 w-3" /> Added
        </Badge>
      ) : (
        <Button
          size="sm"
          variant={inQueue ? 'secondary' : 'default'}
          className="shrink-0 gap-1.5"
          onClick={onAdd}
          disabled={addState === 'adding'}
          aria-label={`Add ${title} to the queue`}
        >
          <Plus className="h-4 w-4" />
          {addState === 'adding' ? 'Adding…' : inQueue ? 'Add again' : 'Add'}
        </Button>
      )}
    </div>
  );
}
