'use client';

import { useMemo, useState } from 'react';
import { Search, ListPlus } from 'lucide-react';
import { toast } from 'sonner';
import { getSocket } from '@/lib/socket-client';
import { useRoomStore } from '@/features/room/store';
import { useQueueStore } from '@/features/queue/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/feedback/Spinner';
import { EmptyState } from '@/components/feedback/EmptyState';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useActivityPing } from '@/features/queue/activityStore';
import { useYouTubeSearch } from '../hooks/useYouTubeSearch';
import { SearchResultCard, type AddState } from './SearchResultCard';

/**
 * In-app YouTube search (Phase 3). Opens over the room (never a route change) so
 * discovery and listening share one surface. Explicit submit (quota-safe); rich
 * result cards; one-tap Add to the shared queue via the existing `queue:add`
 * command (server stays authoritative — all Phase 1 guards apply). A duplicate is
 * a soft confirm ("Add anyway"); availability degrades to the "Add song" paste path.
 */
export function SearchDialog() {
  const roomId = useRoomStore((s) => s.room?.id ?? null);
  const items = useQueueStore((s) => s.items);
  const queueVideoIds = useMemo(() => new Set(items.map((i) => i.videoId)), [items]);

  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [addState, setAddState] = useState<Record<string, AddState>>({});
  const { status, results, error, submittedQuery, search, reset } = useYouTubeSearch(roomId);
  const pingActivity = useActivityPing();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    pingActivity(roomId); // let others see "X is adding a song…"
    void search(value);
  };

  const add = (videoId: string, title: string, allowDuplicate = false) => {
    if (!roomId) return;
    pingActivity(roomId);
    setAddState((s) => ({ ...s, [videoId]: 'adding' }));
    getSocket().emit('queue:add', { roomId, urlOrId: videoId, allowDuplicate }, (res) => {
      if (res.success) {
        setAddState((s) => ({ ...s, [videoId]: 'added' }));
        toast.success(`Added “${title}”`);
        return;
      }
      setAddState((s) => ({ ...s, [videoId]: 'idle' }));
      if (res.code === 'queue.duplicate') {
        // Warn-not-block: let the user deliberately re-add.
        toast(res.message, {
          action: { label: 'Add anyway', onClick: () => add(videoId, title, true) },
        });
      } else {
        toast.error(res.message);
      }
    });
  };

  const onOpenChange = (o: boolean) => {
    setOpen(o);
    if (o) {
      pingActivity(roomId); // signal intent to add as soon as search opens
    } else {
      reset();
      setValue('');
      setAddState({});
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary" className="gap-1.5">
          <Search className="h-4 w-4" />
          Search
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Search YouTube
          </DialogTitle>
          <DialogDescription>
            Find a song and add it to the shared queue — without leaving the room.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Search songs, artists, videos…"
              autoFocus
              className="pl-9"
            />
          </div>
          <Button type="submit" disabled={!value.trim() || status === 'loading'}>
            Search
          </Button>
        </form>

        <div className="min-h-[16rem] min-w-0">
          {status === 'idle' && (
            <EmptyState
              icon={<Search className="h-6 w-6" />}
              title="Search for music"
              description="Type a song or artist above and press Search."
            />
          )}
          {status === 'loading' && (
            <div className="flex justify-center py-16">
              <Spinner label="Searching" />
            </div>
          )}
          {status === 'error' && (
            <EmptyState title="Search failed" description={error ?? 'Please try again.'} />
          )}
          {status === 'unavailable' && (
            <EmptyState
              icon={<ListPlus className="h-6 w-6" />}
              title="Search is unavailable right now"
              description="Use “Add song” to paste a YouTube link instead."
            />
          )}
          {status === 'ready' && results.length === 0 && (
            <EmptyState
              title={`No results for “${submittedQuery}”`}
              description="Try a different search, or paste a link with “Add song”."
            />
          )}
          {status === 'ready' && results.length > 0 && (
            <div className="max-h-[22rem] space-y-0.5 overflow-y-auto overflow-x-hidden scrollbar-thin pr-1">
              {results.map((r) => (
                <SearchResultCard
                  key={r.videoId}
                  result={r}
                  inQueue={queueVideoIds.has(r.videoId)}
                  addState={addState[r.videoId] ?? 'idle'}
                  onAdd={() => add(r.videoId, r.title)}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
