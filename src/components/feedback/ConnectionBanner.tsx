'use client';

import { Wifi, WifiOff } from 'lucide-react';
import { useConnectionStore } from '@/stores/connectionStore';
import { cn } from '@/lib/utils';

/**
 * Non-blocking real-time status pill. Hidden while connected; shows
 * "Reconnecting…" during transient drops (UI_UX_DESIGN §14).
 */
export function ConnectionBanner({ className }: { className?: string }) {
  const status = useConnectionStore((s) => s.status);

  if (status === 'connected' || status === 'idle') return null;

  const reconnecting = status === 'reconnecting' || status === 'connecting';

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
        reconnecting
          ? 'border-accent/40 bg-accent/10 text-accent'
          : 'border-destructive/40 bg-destructive/10 text-destructive',
        className,
      )}
    >
      {reconnecting ? (
        <Wifi className="h-3.5 w-3.5 animate-pulse-ring" />
      ) : (
        <WifiOff className="h-3.5 w-3.5" />
      )}
      {reconnecting ? 'Reconnecting…' : 'Disconnected'}
    </div>
  );
}
