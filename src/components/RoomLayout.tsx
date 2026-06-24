'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Users, ListMusic, Music2, MessageCircle, DoorClosed } from 'lucide-react';
import { useRoomStore } from '@/features/room/store';
import { useChatStore } from '@/features/chat/store';
import { useRoomExperience } from '@/features/room/hooks/useRoomExperience';
import { useChatNotifications } from '@/features/chat/hooks/useChatNotifications';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { cn } from '@/lib/utils';
import { RoomHeader } from './RoomHeader';
import { ParticipantList } from './ParticipantList';
import { PlaybackPanel } from './PlaybackPanel';
import { QueueList } from './QueueList';
import { ChatPanel } from './ChatPanel';
import { RoomSkeleton } from './room/RoomSkeleton';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

function Fallback({ title, body, icon }: { title: string; body: string; icon?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-aurora px-6 text-center">
      {icon && (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-muted-foreground">
          {icon}
        </div>
      )}
      <h1 className="text-xl font-semibold text-foreground">{title}</h1>
      <p className="max-w-[34ch] text-sm text-muted-foreground">{body}</p>
      <Button asChild className="mt-1">
        <Link href="/">Back to Home</Link>
      </Button>
    </div>
  );
}

/** Desktop ≥1024: three columns — participants · player+queue · chat.
 *  The middle column stacks the player over the queue. The queue panel reserves at
 *  least ~5 rows (`min-h-[22rem]` ≈ 5 × 56px row + header) so users always see the
 *  current track plus several upcoming ones before scrolling (Feature 1); the player
 *  keeps its natural (capped) height (`shrink-0`) and the column scrolls only when a
 *  short viewport can't fit both — never crushing the queue. */
function DesktopLayout() {
  return (
    <div className="grid h-full min-h-0 grid-cols-[clamp(220px,18vw,280px)_minmax(0,1fr)_clamp(300px,24vw,360px)] gap-3 p-3">
      <ParticipantList />
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto scrollbar-thin">
        <div className="shrink-0">
          <PlaybackPanel />
        </div>
        <div className="min-h-[22rem] flex-1">
          <QueueList />
        </div>
      </div>
      <ChatPanel />
    </div>
  );
}

/** Tablet 768–1023: player + chat; participants & queue in sheets. */
function TabletLayout() {
  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <div className="flex shrink-0 gap-2">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="secondary" size="sm" className="gap-1.5">
              <Users className="h-4 w-4" /> People
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 p-0">
            <SheetTitle className="sr-only">Participants</SheetTitle>
            <ParticipantList bare />
          </SheetContent>
        </Sheet>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="secondary" size="sm" className="gap-1.5">
              <ListMusic className="h-4 w-4" /> Queue
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-96 p-0">
            <SheetTitle className="sr-only">Queue</SheetTitle>
            <QueueList bare />
          </SheetContent>
        </Sheet>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px] gap-3">
        <div className="min-h-0 overflow-y-auto scrollbar-thin">
          <PlaybackPanel />
        </div>
        <ChatPanel />
      </div>
    </div>
  );
}

/** Mobile <768: single column, bottom tab bar (Player/Queue/Chat/People).
 *  Controlled so the Chat tab can surface an unread badge while the user is on
 *  another tab, and so chat visibility (for unread gating) tracks the active tab. */
function MobileLayout() {
  const [tab, setTab] = useState('player');
  const unread = useChatStore((s) => s.unread);
  const tabs = [
    { value: 'player', label: 'Player', Icon: Music2 },
    { value: 'queue', label: 'Queue', Icon: ListMusic },
    { value: 'chat', label: 'Chat', Icon: MessageCircle },
    { value: 'people', label: 'People', Icon: Users },
  ];
  return (
    <Tabs value={tab} onValueChange={setTab} className="flex h-full flex-col">
      {/*
        forceMount keeps every tab in the DOM (Radix just toggles `hidden`) so the
        YouTube player never unmounts when switching tabs — audio, playback, sync,
        and clock state continue uninterrupted (Feature 3 / "Spotify mobile"). The
        single mounted player is shared via the stores by all breakpoints.
      */}
      <div className="min-h-0 flex-1 p-3">
        <TabsContent
          forceMount
          value="player"
          className="mt-0 h-full overflow-y-auto scrollbar-thin data-[state=inactive]:hidden"
        >
          <PlaybackPanel />
        </TabsContent>
        <TabsContent
          forceMount
          value="queue"
          className="mt-0 h-full overflow-hidden data-[state=inactive]:hidden"
        >
          <QueueList />
        </TabsContent>
        <TabsContent
          forceMount
          value="chat"
          className="mt-0 h-full overflow-hidden data-[state=inactive]:hidden"
        >
          {/* visible drives unread gating: counting pauses while chat is open. */}
          <ChatPanel visible={tab === 'chat'} />
        </TabsContent>
        <TabsContent
          forceMount
          value="people"
          className="mt-0 h-full overflow-hidden data-[state=inactive]:hidden"
        >
          <ParticipantList />
        </TabsContent>
      </div>
      <TabsList className="m-3 grid shrink-0 grid-cols-4 gap-1 rounded-2xl">
        {tabs.map(({ value, label, Icon }) => {
          // Badge only on Chat, only while the user is on another tab and unread > 0.
          const showBadge = value === 'chat' && tab !== 'chat' && unread > 0;
          return (
            <TabsTrigger
              key={value}
              value={value}
              className="relative h-auto flex-col gap-1 py-2 text-xs"
            >
              <span className="relative">
                <Icon className={cn('h-4 w-4', showBadge && 'text-primary')} />
                {showBadge && (
                  <span
                    aria-label={`${unread} unread message${unread === 1 ? '' : 's'}`}
                    className="absolute -right-2.5 -top-2 inline-flex h-4 min-w-4 animate-fade-in items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground shadow-glow"
                  >
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </span>
              <span className={cn(showBadge && 'font-medium text-primary')}>{label}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}

/**
 * Top-level room experience. Owns the connection lifecycle (via the hook) and
 * mounts exactly ONE layout per breakpoint. All panels are pure store consumers,
 * so the single realtime subscription in useRoomExperience feeds every layout.
 */
export function RoomLayout({ roomId }: { roomId: string }) {
  useRoomExperience(roomId);
  useChatNotifications(); // desktop + tab-title chat notifications when backgrounded

  const isReady = useRoomStore((s) => s.isReady);
  const closed = useRoomStore((s) => s.closed);
  const error = useRoomStore((s) => s.error);
  const bp = useBreakpoint();

  if (error) return <Fallback title="Something went wrong" body={error} />;
  if (closed)
    return (
      <Fallback
        icon={<DoorClosed className="h-7 w-7" />}
        title="This room has closed"
        body="The session ended or the host left. Start a new one anytime."
      />
    );
  if (!isReady) return <RoomSkeleton />;

  return (
    <div className="flex h-dvh flex-col">
      <RoomHeader />
      <main className="min-h-0 flex-1">
        {bp === 'desktop' ? (
          <DesktopLayout />
        ) : bp === 'tablet' ? (
          <TabletLayout />
        ) : (
          <MobileLayout />
        )}
      </main>
    </div>
  );
}
