'use client';

import { useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getSocket } from '@/lib/socket-client';
import { useRoomStore } from '@/features/room/store';
import { useChatStore } from '@/features/chat/store';
import { Panel } from '@/components/layout/Panel';
import { MessageList } from './chat/MessageList';
import { MessageInput } from './chat/MessageInput';

/**
 * Live chat (SPEC §7.11). Sends via `chat:send` (ack'd); the store dedupes the
 * ack against the `chat:messagePosted` broadcast by id. History hydrates on join.
 * Stays usable when playback is degraded (shares no state with the player).
 *
 * `visible` tells the store whether chat is on-screen so unread counting can pause
 * while it's open and reset when reopened (Feature 2). Desktop/tablet render chat
 * as a permanent column (default `true`); mobile passes `tab === 'chat'`.
 */
export function ChatPanel({ visible = true }: { visible?: boolean } = {}) {
  const room = useRoomStore((s) => s.room);
  const selfId = useRoomStore((s) => s.session?.id ?? null);
  const messages = useChatStore((s) => s.messages);
  const systemEvents = useChatStore((s) => s.systemEvents);
  const setChatVisible = useChatStore((s) => s.setChatVisible);

  // Report visibility → store gates/clears unread. Becoming visible clears the badge.
  useEffect(() => {
    setChatVisible(visible);
  }, [visible, setChatVisible]);

  const send = (text: string): Promise<boolean> =>
    new Promise((resolve) => {
      const roomId = room?.id;
      if (!roomId) return resolve(false);
      getSocket().emit('chat:send', { roomId, body: text }, (res) => {
        if (!res.success) toast.error(res.message);
        resolve(res.success);
      });
    });

  return (
    <Panel title="Chat" icon={<MessageCircle className="h-4 w-4" />} flush className="h-full">
      <MessageList messages={messages} systemEvents={systemEvents} selfId={selfId} />
      <MessageInput onSend={send} disabled={!room} />
    </Panel>
  );
}
