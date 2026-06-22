import { Skeleton } from '@/components/ui/skeleton';

/**
 * Loading placeholder for the room — mirrors the desktop 3-column shell so the
 * join transition never flashes a blank screen. Collapses to a single column on
 * mobile (the side rails are hidden), matching the live layout.
 */
export function RoomSkeleton() {
  return (
    <div className="flex h-dvh flex-col">
      {/* header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>

      <div className="grid h-full w-full gap-3 p-3 lg:grid-cols-[clamp(220px,18vw,280px)_minmax(0,1fr)_clamp(300px,24vw,360px)]">
        {/* participants */}
        <div className="surface-panel hidden flex-col gap-3 p-4 lg:flex">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>

        {/* player + queue */}
        <div className="flex min-h-0 flex-col gap-3">
          <div className="surface-panel flex flex-col gap-4 p-5">
            <Skeleton className="aspect-video w-full rounded-xl" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-2 w-full rounded-full" />
            <div className="flex justify-center gap-5">
              <Skeleton className="h-9 w-9 rounded-full" />
              <Skeleton className="h-14 w-14 rounded-full" />
              <Skeleton className="h-9 w-9 rounded-full" />
            </div>
          </div>
          <div className="surface-panel hidden flex-1 flex-col gap-2 p-4 lg:flex">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-10" />
              </div>
            ))}
          </div>
        </div>

        {/* chat */}
        <div className="surface-panel hidden flex-col gap-3 p-4 lg:flex">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={i % 2 ? 'flex justify-end' : 'flex'}>
              <Skeleton className="h-12 w-2/3 rounded-2xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
