'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Music2, Radio, Users } from 'lucide-react';
import { listPublicRooms } from '@/features/room/services/roomApi';
import type { PublicRoomDto } from '@/shared/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { JoinRoomDialog } from '@/components/room/JoinRoomDialog';

type LoadState = 'loading' | 'ready' | 'error';

/** How often the list silently re-fetches so it always shows live rooms. */
const POLL_MS = 8000;

/** Browse + join rooms. Public rooms join in one click; private rooms are shown
 *  locked and require the code. Fetches on mount and polls for fresh data. */
export function RoomBrowser() {
  const router = useRouter();
  const [rooms, setRooms] = useState<PublicRoomDto[]>([]);
  const [state, setState] = useState<LoadState>('loading');

  useEffect(() => {
    let active = true;

    const fetchRooms = async (initial: boolean) => {
      try {
        const { rooms } = await listPublicRooms();
        if (!active) return;
        setRooms(rooms);
        setState('ready');
      } catch {
        // Only hard-fail the very first load; keep showing last data on poll errors.
        if (active && initial) setState('error');
      }
    };

    void fetchRooms(true);
    const timer = setInterval(() => void fetchRooms(false), POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        {state === 'ready' && rooms.length > 0
          ? `${rooms.length} ${rooms.length === 1 ? 'room' : 'rooms'} live right now`
          : 'Rooms anyone can browse'}
      </p>

      {state === 'loading' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      )}

      {state === 'error' && (
        <div className="surface-panel flex flex-col items-center gap-3 p-10 text-center">
          <p className="text-sm text-muted-foreground">Couldn’t load rooms. Reconnecting…</p>
        </div>
      )}

      {state === 'ready' && rooms.length === 0 && (
        <div className="surface-panel flex flex-col items-center gap-4 p-12 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Radio className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">No rooms yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Be the first — use “Create a room” above and friends can join from here.
            </p>
          </div>
        </div>
      )}

      {state === 'ready' && rooms.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => {
            const isPrivate = room.visibility === 'private';
            return (
              <div
                key={room.id}
                className="group surface-panel flex flex-col gap-4 p-5 transition-colors hover:border-border"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="flex min-w-0 items-center gap-1.5 text-base font-semibold text-foreground">
                    {isPrivate && (
                      <Lock
                        className="h-4 w-4 shrink-0 text-muted-foreground"
                        aria-label="Private room"
                      />
                    )}
                    <span className="line-clamp-2">{room.name}</span>
                  </h3>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    {room.listenerCount}
                  </span>
                </div>

                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  {isPrivate ? (
                    <>
                      <Lock className="h-4 w-4 shrink-0" />
                      <span>Private — enter the code to join</span>
                    </>
                  ) : (
                    <>
                      <Music2 className="h-4 w-4 shrink-0" />
                      <span className="line-clamp-1">
                        {room.nowPlayingTitle ?? 'Nothing playing yet'}
                      </span>
                    </>
                  )}
                </p>

                <div className="mt-auto">
                  {isPrivate || !room.code ? (
                    <JoinRoomDialog />
                  ) : (
                    <Button
                      className="w-full gap-2"
                      onClick={() => router.push(`/join/${room.code}`)}
                    >
                      Join room
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
