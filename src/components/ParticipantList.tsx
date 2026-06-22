'use client';

import { Users } from 'lucide-react';
import { useParticipantsStore } from '@/features/participants/store';
import { useRoomStore } from '@/features/room/store';
import { Panel } from '@/components/layout/Panel';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ParticipantCard } from './ParticipantCard';

/** Left rail: who's in the room, who's host, who's online. */
export function ParticipantList({ bare = false }: { bare?: boolean } = {}) {
  const participants = useParticipantsStore((s) => s.participants);
  const selfId = useRoomStore((s) => s.session?.id ?? null);

  // Host first, then by join order (the store already sorts by joinedAt).
  const ordered = [...participants].sort(
    (a, b) => Number(b.role === 'host') - Number(a.role === 'host'),
  );
  const onlineCount = participants.filter((p) => p.isOnline).length;

  return (
    <Panel
      title="Participants"
      icon={<Users className="h-4 w-4" />}
      meta={`${onlineCount} online`}
      flush
      bare={bare}
      className="h-full"
    >
      <ScrollArea className="flex-1 scrollbar-thin">
        <div className="space-y-0.5 p-2">
          {ordered.map((p) => (
            <ParticipantCard key={p.sessionId} participant={p} isSelf={p.sessionId === selfId} />
          ))}
        </div>
      </ScrollArea>
      {participants.length <= 1 && (
        <div className="border-t border-border/60 p-3">
          <EmptyState
            className="py-4"
            title="You're the only one here"
            description="Share the room link to listen together."
          />
        </div>
      )}
    </Panel>
  );
}
