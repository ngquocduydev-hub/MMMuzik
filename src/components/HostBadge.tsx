import { Crown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** Host indicator — icon + text so colour isn't the only signal (a11y). */
export function HostBadge({ className }: { className?: string }) {
  return (
    <Badge variant="accent" className={cn('gap-1', className)}>
      <Crown className="h-3 w-3" aria-hidden />
      Host
    </Badge>
  );
}
