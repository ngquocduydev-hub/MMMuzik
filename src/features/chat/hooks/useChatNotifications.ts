'use client';

import { useEffect, useRef } from 'react';
import { useChatStore } from '@/features/chat/store';
import { useRoomStore } from '@/features/room/store';
import { useChatNotifyStore } from '@/features/chat/notificationStore';

/**
 * Cross-tab chat notifications (mount once per room). When a message from someone
 * else arrives while the room is NOT the focused window (minimized / behind another
 * app / another tab):
 *   - always: a "(N)" unread badge on the document title (no permission needed),
 *   - opt-in: an OS desktop Notification (gated by the bell toggle + permission).
 * Returning focus clears the title badge. Complements the in-app mobile unread badge.
 */
export function useChatNotifications(): void {
  const lastIdRef = useRef<string | null>(null);
  const unreadRef = useRef(0);
  const baseTitleRef = useRef('');

  useEffect(() => {
    // Capture the page title without any pre-existing "(N)" prefix.
    baseTitleRef.current = document.title.replace(/^\(\d+\)\s*/, '');
    const msgs = useChatStore.getState().messages;
    lastIdRef.current = msgs.length ? (msgs[msgs.length - 1]?.id ?? null) : null;

    const applyTitle = () => {
      const n = unreadRef.current;
      document.title = n > 0 ? `(${n}) ${baseTitleRef.current}` : baseTitleRef.current;
    };
    const clearBadge = () => {
      if (unreadRef.current !== 0) {
        unreadRef.current = 0;
        applyTitle();
      }
    };
    const onVisibility = () => {
      if (!document.hidden) clearBadge();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', clearBadge);

    // Ask for OS-notification permission on the first interaction in the room (a
    // gesture is required by browsers). The user is in a live room, so the intent to
    // be alerted is clear; only prompts once and only if not already decided.
    const requestPermission = () => {
      if (
        typeof Notification !== 'undefined' &&
        Notification.permission === 'default' &&
        useChatNotifyStore.getState().enabled
      ) {
        void Notification.requestPermission();
      }
    };
    window.addEventListener('pointerdown', requestPermission, { once: true });
    window.addEventListener('keydown', requestPermission, { once: true });

    const unsubscribe = useChatStore.subscribe((state) => {
      const list = state.messages;
      if (list.length === 0) {
        lastIdRef.current = null;
        return;
      }
      const last = list[list.length - 1]!;
      if (last.id === lastIdRef.current) return; // not a new message (e.g. unread/visibility change)
      lastIdRef.current = last.id;

      if (last.sessionId === (useRoomStore.getState().session?.id ?? null)) return; // my own message
      // Notify whenever the room isn't the focused window — minimized, behind another
      // app, OR a different tab. (document.hidden alone misses "switched to another app".)
      if (document.hasFocus()) return; // user is actively here — in-app UI handles it

      unreadRef.current += 1;
      applyTitle();

      const { enabled } = useChatNotifyStore.getState();
      if (enabled && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const roomName = useRoomStore.getState().room?.name ?? 'your room';
        try {
          const note = new Notification(`${last.nickname} · ${roomName}`, {
            body: last.body,
            tag: 'mmmuzik-chat', // same tag → newer message replaces the previous one
          });
          note.onclick = () => {
            window.focus();
            note.close();
          };
        } catch {
          /* Notification construction can throw on some platforms — ignore */
        }
      }
    });

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', clearBadge);
      window.removeEventListener('pointerdown', requestPermission);
      window.removeEventListener('keydown', requestPermission);
      unsubscribe();
      document.title = baseTitleRef.current;
    };
  }, []);
}
