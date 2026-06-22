'use client';

import { ListMusic, SkipForward } from 'lucide-react';
import { getSocket } from '@/lib/socket-client';
import { useRoomStore } from '@/features/room/store';
import { usePlaybackStore } from '@/features/playback/store';
import { useQueueStore } from '@/features/queue/store';
import { useUpNextCount } from '@/features/queue/selectors';
import { Panel } from '@/components/layout/Panel';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EmptyState } from '@/components/feedback/EmptyState';
import { AddSongDialog } from './queue/AddSongDialog';
import { QueueItem } from './queue/QueueItem';

/**
 * Shared up-next queue (V1 §7). Anyone can add AND Skip the current track (the
 * collaborative "aux cord"); only the host can remove a queued (non-current) track
 * via the row's hover "X". No reorder UI (V1 §7.5) — songs append to the tail. The
 * current track is highlighted and pinned. All mutations go through the server's
 * queue engine, which stays authoritative and enforces the host-only remove.
 */
export function QueueList({ bare = false }: { bare?: boolean } = {}) {
  const items = useQueueStore((s) => s.items);
  const room = useRoomStore((s) => s.room);
  const session = useRoomStore((s) => s.session);
  const currentTrackId = usePlaybackStore((s) => s.playback?.currentTrackId ?? null);

  const roomId = room?.id;
  const isHost = !!room && !!session && room.hostSessionId === session.id;

  // "Up next" = videos AFTER the currently-playing one (single source of truth).
  const upNext = useUpNextCount();

  const remove = (id: string) => {
    if (roomId) getSocket().emit('queue:remove', { roomId, queueItemId: id }, () => {});
  };
  // Any participant: end the current track now → server advances to next (or idle).
  const skip = () => {
    if (roomId) getSocket().emit('playback:skip', { roomId }, () => {});
  };

  return (
    <Panel
      title="Queue"
      icon={<ListMusic className="h-4 w-4" />}
      meta={upNext > 0 ? `${upNext} up next` : undefined}
      action={
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={skip}
            disabled={!currentTrackId}
            aria-label="Skip current track"
            className="gap-1.5"
          >
            <SkipForward className="h-4 w-4" />
            Skip
          </Button>
          <AddSongDialog />
        </div>
      }
      flush
      bare={bare}
      className="h-full"
    >
      {items.length === 0 ? (
        <EmptyState
          className="py-8"
          icon={<ListMusic className="h-6 w-6" />}
          title="Queue's empty"
          description="Add the first song to get the room going."
        />
      ) : (
        <ScrollArea className="flex-1 scrollbar-thin">
          <div className="space-y-0.5 p-2">
            {items.map((item, i) => (
              <QueueItem
                key={item.id}
                item={item}
                index={i}
                isCurrent={item.id === currentTrackId}
                canEdit={isHost}
                onRemove={() => remove(item.id)}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </Panel>
  );
}
