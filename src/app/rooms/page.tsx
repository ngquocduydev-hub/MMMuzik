import type { Metadata } from 'next';
import { Logo } from '@/components/layout/Logo';
import { CreateRoomDialog } from '@/components/room/CreateRoomDialog';
import { RoomBrowser } from '@/components/room/RoomBrowser';

export const metadata: Metadata = { title: 'Browse rooms · MMMuzik' };

/** /rooms — discover and join active public rooms. */
export default function RoomsPage() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[40vh] bg-aurora"
        aria-hidden
      />
      <div className="relative mx-auto flex min-h-dvh max-w-6xl flex-col px-5 sm:px-8">
        <header className="flex items-center justify-between gap-3 py-6">
          <Logo href="/" size="md" />
          <CreateRoomDialog />
        </header>

        <main className="flex flex-1 flex-col gap-8 py-6 lg:py-10">
          <div className="flex flex-col gap-3">
            <h1 className="text-balance text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
              Come say hi! <span className="inline-block origin-[70%_70%] animate-wave">👋</span>
            </h1>
            <p className="max-w-xl text-pretty text-lg text-muted-foreground sm:text-xl">
              Good conversations. Great memories.{' '}
              <span className="font-semibold text-gradient-brand">Better together.</span>
            </p>
          </div>

          <RoomBrowser />
        </main>

        <footer className="border-t border-border/50 py-6 text-center text-xs text-muted-foreground">
          No account needed. Just a nickname. · Built with Next.js · MMMuzik
        </footer>
      </div>
    </div>
  );
}
