'use client';

import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@/lib/utils';

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, orientation = 'horizontal', ...props }, ref) => {
  const vertical = orientation === 'vertical';
  return (
    <SliderPrimitive.Root
      ref={ref}
      orientation={orientation}
      className={cn(
        'group relative flex touch-none select-none',
        vertical ? 'h-full w-fit flex-col items-center' : 'w-full items-center',
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        className={cn(
          'relative grow overflow-hidden rounded-full bg-surface-2',
          vertical ? 'h-full w-1.5' : 'h-1.5 w-full',
        )}
      >
        <SliderPrimitive.Range
          className={cn('absolute bg-primary', vertical ? 'w-full' : 'h-full')}
        />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className={cn(
          'block h-3.5 w-3.5 rounded-full border-2 border-primary bg-foreground shadow transition',
          'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:pointer-events-none disabled:opacity-50',
        )}
      />
    </SliderPrimitive.Root>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
