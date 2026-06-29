import Link from 'next/link';
import { ListMusic, LogIn, MessagesSquare, Radio } from 'lucide-react';
import { Logo } from '@/components/layout/Logo';
import { SoundBars } from '@/components/feedback/SoundBars';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Button } from '@/components/ui/button';
import { CreateRoomDialog } from '@/components/room/CreateRoomDialog';
import { HomePreviewCard } from '@/components/room/HomePreviewCard';
import { cn } from '@/lib/utils';

const LISTENERS = ['Mai', 'Lena', 'Gabe', 'Sora'];

const FEATURES = [
  {
    icon: Radio,
    title: 'In perfect sync',
    body: 'Everyone hears the same beat at the same moment — playback stays locked to the host.',
    tint: 'from-primary/20 text-primary',
  },
  {
    icon: ListMusic,
    title: 'A shared queue',
    body: 'Anyone can drop a YouTube link. Build the vibe together, track by track.',
    tint: 'from-accent/20 text-accent',
  },
  {
    icon: MessagesSquare,
    title: 'Chat in real time',
    body: 'React, recommend, and hang out in a live room chat while the music plays.',
    tint: 'from-success/20 text-success',
  },
] as const;

export default function HomePage() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[70vh] bg-aurora"
        aria-hidden
      />
      <div className="relative mx-auto flex min-h-dvh max-w-6xl flex-col px-5 sm:px-8">
        <header className="flex items-center justify-between py-6">
          <Logo size="md" />
          <Link
            href="/rooms"
            className="rounded-lg text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Browse rooms
          </Link>
        </header>

        <main className="flex flex-1 flex-col justify-center gap-16 py-12 lg:py-16">
          {/* Hero */}
          <section className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
            <div className="flex flex-col gap-6">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs font-medium text-muted-foreground">
                <SoundBars playing />
                Real-time listening rooms
              </span>

              <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Listen to music <span className="text-gradient-brand">together</span>, in real time.
              </h1>

              <p className="max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
                Create a room, share the link, and press play. MMMuzik keeps everyone in sync — with
                a shared queue and live chat. No account needed, just a nickname.
              </p>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <CreateRoomDialog />
                <Button asChild size="lg" variant="secondary" className="w-full gap-2 sm:w-auto">
                  <Link href="/rooms">
                    <LogIn className="h-5 w-5" />
                    Join a room
                  </Link>
                </Button>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <div className="flex -space-x-2">
                  {LISTENERS.map((name) => (
                    <UserAvatar key={name} name={name} className="h-8 w-8 ring-2 ring-background" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">2,400+</span> sessions started this
                  week
                </p>
              </div>
            </div>

            {/* Preview card (desktop only) */}
            <div className="relative hidden lg:block">
              <div className="absolute -inset-6 rounded-[2rem] bg-aurora blur-2xl" aria-hidden />
              <HomePreviewCard />
            </div>
          </section>

          {/* Feature cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body, tint }) => (
              <div
                key={title}
                className="group surface-panel p-5 transition-colors hover:border-border"
              >
                <div
                  className={cn(
                    'mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br to-transparent',
                    tint,
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mb-1.5 text-base font-semibold text-foreground">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </main>

        <footer className="border-t border-border/50 py-6 text-center text-xs text-muted-foreground">
          No account needed. Just a nickname. · Built with Next.js · MMMuzik
        </footer>
      </div>
    </div>
  );
}
