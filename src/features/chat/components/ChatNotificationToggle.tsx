'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useChatNotifyStore } from '@/features/chat/notificationStore';

/** Immediate confirmation so the user SEES that notifications work (or that the OS
 *  is suppressing them, e.g. Focus Assist) the moment they turn them on. */
function fireTestNotification() {
  toast('🔔 Chat notifications on', {
    description: 'You will get a popup for new messages when this tab is in the background.',
  });
  try {
    new Notification('MMMuzik', { body: 'Chat notifications are on 🎉', tag: 'mmmuzik-chat' });
  } catch {
    /* ignore */
  }
}

/**
 * Bell toggle in the chat header. Click to enable desktop notifications for new
 * messages while the tab is backgrounded (requests browser permission on first
 * enable). Hidden where the Notification API is unavailable; disabled (with a hint)
 * if the user has blocked notifications at the browser level.
 */
export function ChatNotificationToggle() {
  const enabled = useChatNotifyStore((s) => s.enabled);
  const setEnabled = useChatNotifyStore((s) => s.setEnabled);
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>('default');

  useEffect(() => {
    setPerm(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  }, []);

  if (perm === 'unsupported') return null;

  const denied = perm === 'denied';
  const active = enabled && perm === 'granted';

  const onClick = async () => {
    if (perm === 'granted') {
      const next = !enabled;
      setEnabled(next);
      if (next) fireTestNotification();
      return;
    }
    const result = await Notification.requestPermission();
    setPerm(result);
    if (result === 'granted') {
      setEnabled(true);
      fireTestNotification();
    } else {
      setEnabled(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      disabled={denied}
      aria-label={active ? 'Turn off chat notifications' : 'Turn on chat notifications'}
      title={
        denied
          ? 'Notifications are blocked in your browser settings'
          : active
            ? 'Chat notifications on'
            : 'Notify me of new messages when this tab is in the background'
      }
      className={active ? 'text-primary' : 'text-muted-foreground'}
    >
      {active ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
    </Button>
  );
}
