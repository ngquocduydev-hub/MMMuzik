'use client';

import { Volume2, Volume1, VolumeX, Captions, CaptionsOff } from 'lucide-react';
import { usePlayerStore } from '@/features/playback/playerStore';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

const PILL =
  'grid h-7 w-7 shrink-0 place-items-center rounded-full bg-black/70 backdrop-blur transition hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40';

/**
 * Bottom-right video controls: a subtitles (CC) toggle and a volume button with a
 * VERTICAL slider that pops up on hover/focus. Dragging the slider to the bottom (0)
 * mutes; the speaker button toggles mute. All are LOCAL per-client preferences (the
 * YouTubePlayer subscribes to the store and applies them) — never server playback.
 * Before the first gesture the player is autoplay-muted, so we show a one-time
 * "Tap to enable sound" nudge instead.
 */
export function VolumeControl() {
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const gestured = usePlayerStore((s) => s.gestured);
  const captions = usePlayerStore((s) => s.captions);

  const effective = muted ? 0 : volume;
  const VolIcon = effective === 0 ? VolumeX : effective < 50 ? Volume1 : Volume2;

  const onSlider = (next: number) => {
    const { setVolume, setMuted, setGestured } = usePlayerStore.getState();
    setGestured();
    if (next <= 0) {
      setVolume(0);
      setMuted(true); // dragged to the bottom → mute
    } else {
      setVolume(next); // setVolume also unmutes
    }
  };

  const toggleMute = () => {
    const s = usePlayerStore.getState();
    s.setGestured();
    if (s.muted || s.volume === 0) {
      if (s.volume === 0) s.setVolume(50);
      else s.setMuted(false);
    } else {
      s.setMuted(true);
    }
  };

  const toggleCaptions = () => {
    const s = usePlayerStore.getState();
    s.setGestured();
    s.setCaptions(!s.captions);
  };

  return (
    <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5">
      {muted && !gestured && (
        <span className="select-none rounded-full bg-black/70 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
          Tap to enable sound
        </span>
      )}

      {/* Subtitles (CC) toggle */}
      <button
        type="button"
        onClick={toggleCaptions}
        aria-label={captions ? 'Turn off subtitles' : 'Turn on subtitles'}
        title={captions ? 'Subtitles on' : 'Subtitles off'}
        className={cn(PILL, captions ? 'text-primary' : 'text-white')}
      >
        {captions ? <Captions className="h-4 w-4" /> : <CaptionsOff className="h-4 w-4" />}
      </button>

      {/* Volume: speaker button + vertical slider that pops up on hover/focus */}
      <div className="group relative">
        <div className="absolute bottom-full left-1/2 hidden -translate-x-1/2 pb-2 group-hover:block group-focus-within:block">
          <div className="flex flex-col items-center rounded-full bg-black/80 px-1.5 py-3 backdrop-blur">
            <Slider
              orientation="vertical"
              value={[effective]}
              onValueChange={(v) => onSlider(v[0] ?? 0)}
              min={0}
              max={100}
              step={1}
              aria-label="Volume"
              className="h-24"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={toggleMute}
          aria-label={effective === 0 ? 'Unmute' : 'Mute'}
          className={cn(PILL, 'text-white')}
        >
          <VolIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
