import Link from 'next/link';
import { cn } from '@/lib/utils';

interface LogoProps {
  /** Render as a link to home. */
  href?: string;
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  className?: string;
}

const SIZE = {
  sm: { dot: 'h-2 w-2', text: 'text-base', gap: 'gap-2' },
  md: { dot: 'h-2.5 w-2.5', text: 'text-lg', gap: 'gap-2.5' },
  lg: { dot: 'h-3 w-3', text: 'text-2xl', gap: 'gap-3' },
} as const;

/**
 * MMMuzik wordmark: three stacked accent dots (the triple-M motif from the
 * reference) + the name. Optionally wraps in a link to home.
 */
export function Logo({ href, size = 'md', showWordmark = true, className }: LogoProps) {
  const s = SIZE[size];
  const inner = (
    <span className={cn('inline-flex items-center', s.gap, className)}>
      <span className="flex items-center gap-1" aria-hidden>
        <span className={cn('rounded-full bg-primary', s.dot)} />
        <span className={cn('rounded-full bg-accent', s.dot)} />
        <span className={cn('rounded-full bg-success', s.dot)} />
      </span>
      {showWordmark && <span className={cn('font-semibold tracking-tight', s.text)}>MMMuzik</span>}
    </span>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label="MMMuzik home"
        className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {inner}
      </Link>
    );
  }
  return inner;
}
