'use client';

import { useEffect, useState } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

/**
 * Cross-cutting responsive helper. Returns the active breakpoint so the room
 * can mount exactly ONE layout (desktop 3-col / tablet / mobile tabs) instead
 * of triple-mounting panels. Defaults to "desktop" for SSR; corrects on mount.
 */
export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>('desktop');

  useEffect(() => {
    const tablet = window.matchMedia('(min-width: 768px) and (max-width: 1023.98px)');
    const desktop = window.matchMedia('(min-width: 1024px)');
    const update = () => setBp(desktop.matches ? 'desktop' : tablet.matches ? 'tablet' : 'mobile');
    update();
    tablet.addEventListener('change', update);
    desktop.addEventListener('change', update);
    return () => {
      tablet.removeEventListener('change', update);
      desktop.removeEventListener('change', update);
    };
  }, []);

  return bp;
}
