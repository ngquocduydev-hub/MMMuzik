import { Headphones, Users, Music2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { RoomSummaryDto } from '@/shared/types';

/** Pre-join room summary card shown on /join/[code] (matches V1). */
export function RoomInfoCard({ summary }: { summary: RoomSummaryDto }) {
  return (
    <div className="surface-panel overflow-hidden">
      <div className="flex items-start gap-4 bg-aurora p-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-glow">
          <Headphones className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            You&apos;re joining
          </p>
          <h2 className="truncate text-xl font-semibold text-foreground">{summary.name}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="tracking-widest">
              {summary.code}
            </Badge>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {summary.listenerCount} listening
            </span>
          </div>
        </div>
      </div>

      {summary.nowPlayingTitle && (
        <div className="flex items-center gap-2 border-t border-border/60 px-5 py-3 text-sm">
          <Music2 className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate text-muted-foreground">
            Now playing{' '}
            <span className="font-medium text-foreground">{summary.nowPlayingTitle}</span>
          </span>
        </div>
      )}
    </div>
  );
}
