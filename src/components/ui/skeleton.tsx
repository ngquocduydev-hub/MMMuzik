import { cn } from '@/lib/utils';

/** Shimmering placeholder block for skeleton loading states. */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-lg bg-surface-2', className)} {...props} />;
}

export { Skeleton };
