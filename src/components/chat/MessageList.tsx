'use client';

import { useEffect, useMemo, useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import type { ChatMessageDto } from '@/shared/types';
import type { SystemChatEvent } from '@/features/chat/store';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ChatMessage } from './ChatMessage';
import { SystemMessage } from './SystemMessage';

type Item =
  | { kind: 'user'; ts: string; message: ChatMessageDto }
  | { kind: 'system'; ts: string; event: SystemChatEvent };

/** Scrolling message list — autoscrolls to the latest, polite live region.
 *  User messages and ephemeral system chips are merged by timestamp. */
export function MessageList({
  messages,
  systemEvents,
  selfId,
}: {
  messages: ChatMessageDto[];
  systemEvents: SystemChatEvent[];
  selfId: string | null;
}) {
  const items = useMemo<Item[]>(() => {
    const merged: Item[] = [
      ...messages.map((m) => ({ kind: 'user' as const, ts: m.sentAt, message: m })),
      ...systemEvents.map((e) => ({ kind: 'system' as const, ts: e.at, event: e })),
    ];
    return merged.sort((a, b) => a.ts.localeCompare(b.ts));
  }, [messages, systemEvents]);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [items.length]);

  if (items.length === 0) {
    return (
      <EmptyState
        className="py-8"
        icon={<MessageSquare className="h-6 w-6" />}
        title="No messages yet"
        description="Say hi 👋 and react to what's playing."
      />
    );
  }

  return (
    <ScrollArea className="flex-1 scrollbar-thin">
      <div className="flex flex-col gap-3 p-4" aria-live="polite" aria-relevant="additions">
        {items.map((item) =>
          item.kind === 'system' ? (
            <SystemMessage key={`s:${item.event.id}`} text={item.event.text} />
          ) : (
            <ChatMessage
              key={item.message.id}
              message={item.message}
              isSelf={item.message.sessionId === selfId}
            />
          ),
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
