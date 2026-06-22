import type { ChatMessageDto } from '@/shared/types';
import { UserAvatar } from '@/components/ui/user-avatar';
import { formatClock } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * One chat row, bubble style (V1 §5.12): own messages right-aligned with a
 * primary bubble (tightened bottom-right corner), others left-aligned on
 * surface-2 (tightened bottom-left). The sender name shows for others only.
 */
export function ChatMessage({ message, isSelf }: { message: ChatMessageDto; isSelf: boolean }) {
  return (
    <div className={cn('flex items-end gap-2.5', isSelf && 'flex-row-reverse')}>
      <UserAvatar name={message.nickname} seed={message.sessionId} size="sm" className="mb-0.5" />
      <div className={cn('flex max-w-[78%] flex-col gap-1', isSelf && 'items-end')}>
        <div className="flex items-baseline gap-2">
          {!isSelf && (
            <span className="truncate text-xs font-medium text-foreground">{message.nickname}</span>
          )}
          <time className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
            {formatClock(message.sentAt)}
          </time>
        </div>
        <div
          className={cn(
            'rounded-2xl px-3 py-2 text-sm leading-relaxed',
            isSelf
              ? 'rounded-br-md bg-primary text-primary-foreground'
              : 'rounded-bl-md bg-surface-2 text-foreground',
          )}
        >
          {message.body}
        </div>
      </div>
    </div>
  );
}
