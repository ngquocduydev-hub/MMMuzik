import { cn } from '@/lib/utils';

/**
 * Tiny animated equalizer — the "now playing" indicator next to the active
 * track / speaking participant. Pauses when `playing` is false.
 */
export function SoundBars({
  playing = true,
  className,
}: {
  playing?: boolean;
  className?: string;
}) {
  return (
    <span aria-hidden className={cn('flex items-end gap-0.5', className)}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            'w-0.5 origin-bottom rounded-full bg-primary',
            playing ? 'animate-equalizer' : 'h-1',
          )}
          style={playing ? { height: '0.75rem', animationDelay: `${i * 0.18}s` } : undefined}
        />
      ))}
    </span>
  );
}
