'use client';

import { useState } from 'react';
import { Copy, Check, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Share affordances: a room-code chip (click to copy the code) + a "Copy link"
 * button (copies the `/join/{code}` invite URL). One-tap share with toast
 * feedback (UI_UX_DESIGN §12.3). Invite links resolve to the join screen.
 */
export function InviteShare({ code, className }: { code: string; className?: string }) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  const copy = async (kind: 'code' | 'link') => {
    const text =
      kind === 'code'
        ? code
        : typeof window !== 'undefined'
          ? `${window.location.origin}/join/${code}`
          : `/join/${code}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      toast.success(kind === 'code' ? 'Room code copied' : 'Invite link copied');
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error('Couldn’t copy — copy it manually');
    }
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <button
        onClick={() => copy('code')}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 font-mono text-sm tracking-widest text-foreground transition hover:border-primary/50"
        aria-label="Copy room code"
      >
        {code}
        {copied === 'code' ? (
          <Check className="h-3.5 w-3.5 text-success" />
        ) : (
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
      <Button variant="secondary" size="sm" onClick={() => copy('link')} className="gap-1.5">
        {copied === 'link' ? (
          <Check className="h-4 w-4 text-success" />
        ) : (
          <Link2 className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">Copy link</span>
      </Button>
    </div>
  );
}
