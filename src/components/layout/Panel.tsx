import * as React from 'react';
import { cn } from '@/lib/utils';

interface PanelProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Section title rendered in the panel header. */
  title?: React.ReactNode;
  /** Optional count/meta shown next to the title. */
  meta?: React.ReactNode;
  /** Right-aligned header actions (e.g. an Add button). */
  action?: React.ReactNode;
  icon?: React.ReactNode;
  /** Remove inner padding on the body (e.g. for full-bleed scroll areas). */
  flush?: boolean;
  /** Drop the card chrome (border/bg/shadow) — used when nested inside a Sheet. */
  bare?: boolean;
  bodyClassName?: string;
}

/**
 * Reusable surface panel with an optional header. Used for the participants,
 * queue, chat, and player columns in the room layout.
 */
export function Panel({
  title,
  meta,
  action,
  icon,
  flush,
  bare,
  className,
  bodyClassName,
  children,
  ...props
}: PanelProps) {
  return (
    <section
      className={cn(
        'flex min-h-0 flex-col overflow-hidden',
        bare ? 'bg-transparent' : 'surface-panel',
        className,
      )}
      {...props}
    >
      {(title || action) && (
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {icon && <span className="text-muted-foreground">{icon}</span>}
            {title && (
              <h2 className="truncate text-sm font-semibold tracking-wide text-foreground">
                {title}
              </h2>
            )}
            {meta != null && (
              <span className="shrink-0 text-xs font-medium text-muted-foreground">{meta}</span>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={cn('flex min-h-0 flex-1 flex-col', !flush && 'p-4', bodyClassName)}>
        {children}
      </div>
    </section>
  );
}
