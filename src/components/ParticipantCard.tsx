'use client';

import type { ParticipantDto } from '@/shared/types';
import { UserAvatar } from '@/components/ui/user-avatar';
import { HostBadge } from './HostBadge';
import { cn } from '@/lib/utils';

/** One participant row: avatar + presence dot, name (+ "you"), host badge. */
export function ParticipantCard({
  participant,
  isSelf,
}: {
  participant: ParticipantDto;
  isSelf: boolean;
}) {
  const { nickname, avatar, role, isOnline } = participant;
  return (
    <div className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-2">
      <div className="relative shrink-0">
        <UserAvatar name={nickname} src={avatar} seed={participant.sessionId} size="md" />
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface',
            isOnline ? 'bg-success' : 'bg-muted-foreground/50',
          )}
          title={isOnline ? 'Online' : 'Offline'}
        >
          <span className="sr-only">{isOnline ? 'Online' : 'Offline'}</span>
        </span>
      </div>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
        {nickname}
        {isSelf && <span className="ml-1 text-xs font-normal text-muted-foreground">(you)</span>}
      </span>
      {role === 'host' && <HostBadge />}
    </div>
  );
}
