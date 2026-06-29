'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useRoomStore } from '@/features/room/store';
import { leaveRoom } from '@/features/room/services/roomApi';
import { Logo } from '@/components/layout/Logo';
import { InviteShare } from '@/components/InviteShare';
import { ConnectionBanner } from '@/components/feedback/ConnectionBanner';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/** Room top bar (matches V1): brand · name + connection · share + leave. */
export function RoomHeader() {
  const router = useRouter();
  const room = useRoomStore((s) => s.room);
  const [leaving, setLeaving] = useState(false);

  if (!room) return null;

  const onLeave = async () => {
    setLeaving(true);
    try {
      await leaveRoom(room.id);
    } catch {
      /* leave best-effort */
    } finally {
      router.push('/rooms');
    }
  };

  return (
    <TooltipProvider delayDuration={150}>
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border/60 bg-surface/60 px-3 py-2.5 backdrop-blur sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Logo href="/" size="sm" showWordmark={false} />
          <div className="hidden h-6 w-px bg-border sm:block" />
          <h1 className="truncate text-sm font-semibold text-foreground sm:text-base">
            {room.name}
          </h1>
          <ConnectionBanner className="hidden sm:inline-flex" />
        </div>

        <div className="flex items-center gap-2">
          <InviteShare code={room.code} />
          <div className="h-6 w-px bg-border" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onLeave}
                disabled={leaving}
                aria-label="Leave room"
                className="text-muted-foreground hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Leave room</TooltipContent>
          </Tooltip>
        </div>
      </header>
    </TooltipProvider>
  );
}
