import { Play } from 'lucide-react';
import { SoundBars } from '@/components/feedback/SoundBars';
import { UserAvatar } from '@/components/ui/user-avatar';

const PREVIEW_CHAT = [
  { name: 'Mai', text: 'this playlist is unreal 🔥' },
  { name: 'Lena', text: 'been on repeat all week' },
];

/** Decorative "now playing" preview shown in the home hero (desktop only) — mirrors V1. */
export function HomePreviewCard() {
  return (
    <div className="surface-panel relative overflow-hidden p-6">
      <div className="flex items-center gap-4">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-accent shadow-glow">
          <div className="flex h-full w-full items-center justify-center text-white">
            <Play className="h-7 w-7 translate-x-0.5 fill-current" />
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-medium text-success">
            <SoundBars playing /> Now playing · in sync
          </div>
          <p className="mt-1 truncate text-lg font-semibold">Blinding Lights</p>
          <p className="truncate text-sm text-muted-foreground">The Weeknd</p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div className="h-full w-[36%] rounded-full bg-primary" />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>1:12</span>
          <span>3:20</span>
        </div>
      </div>

      <div className="mt-5 space-y-2 border-t border-border/60 pt-4">
        {PREVIEW_CHAT.map((m) => (
          <div key={m.name} className="flex items-center gap-2 text-sm">
            <UserAvatar name={m.name} size="sm" className="h-6 w-6" />
            <span className="font-medium text-foreground">{m.name}</span>
            <span className="truncate text-muted-foreground">{m.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
