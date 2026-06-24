'use client';

import { Volume2, Volume1, VolumeX } from 'lucide-react';
import { usePlayerStore } from '@/features/playback/playerStore';
import { Slider } from '@/components/ui/slider';

/**
 * Volume control pinned to the bottom-right of the video. The speaker button
 * toggles mute; hovering (or focusing) reveals a slider that slides out to the
 * left. Dragging the slider to the bottom (0) mutes; raising it unmutes. Volume is
 * a LOCAL listening preference (per-client) — it never touches server playback.
 * The YouTubePlayer subscribes to the store and applies it to the provider player.
 *
 * Before the first gesture, the player is muted by autoplay policy, so we show a
 * "Tap to enable sound" nudge instead of the slider; after any interaction the
 * normal slider control takes over and a manual mute persists.
 */
export function VolumeControl() {
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const gestured = usePlayerStore((s) => s.gestured);

  const effective = muted ? 0 : volume;
  const Icon = effective === 0 ? VolumeX : effective < 50 ? Volume1 : Volume2;

  const onSlider = (next: number) => {
    const { setVolume, setMuted, setGestured } = usePlayerStore.getState();
    setGestured();
    if (next <= 0) {
      setVolume(0);
      setMuted(true); // dragged to the end → mute
    } else {
      setVolume(next); // setVolume also unmutes
    }
  };

  const toggle = () => {
    const s = usePlayerStore.getState();
    s.setGestured();
    if (s.muted || s.volume === 0) {
      // Unmute; if there's no volume to hear (dragged to 0), restore a sensible level.
      if (s.volume === 0) s.setVolume(50);
      else s.setMuted(false);
    } else {
      s.setMuted(true);
    }
  };

  return (
    <div className="group absolute bottom-3 right-3 z-10 flex items-center gap-1 rounded-full bg-black/70 px-1.5 py-1.5 backdrop-blur transition">
      {muted && !gestured ? (
        <span className="select-none px-1 text-xs font-medium text-white">Tap to enable sound</span>
      ) : (
        <div className="flex w-0 items-center overflow-hidden opacity-0 transition-all duration-200 group-hover:w-24 group-hover:pl-1.5 group-hover:opacity-100 group-focus-within:w-24 group-focus-within:pl-1.5 group-focus-within:opacity-100">
          <Slider
            value={[effective]}
            onValueChange={(vals) => onSlider(vals[0] ?? 0)}
            min={0}
            max={100}
            step={1}
            aria-label="Volume"
            className="w-24"
          />
        </div>
      )}
      <button
        type="button"
        onClick={toggle}
        aria-label={effective === 0 ? 'Unmute' : 'Mute'}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <Icon className="h-4 w-4" />
      </button>
    </div>
  );
}
