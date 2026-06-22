import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center">
      <Loader2 className={cn('h-5 w-5 animate-spin text-muted-foreground', className)} />
      <span className="sr-only">{label}…</span>
    </span>
  );
}
