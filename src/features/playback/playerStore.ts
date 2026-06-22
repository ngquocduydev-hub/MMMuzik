import { create } from 'zustand';

/**
 * Client-only player volume/mute (NOT server state — local listening preference).
 * The YouTubePlayer is the single thing that touches the provider player; it
 * subscribes here and applies changes, so UI controls (PlaybackPanel) stay
 * decoupled from the player instance. Starts muted to satisfy autoplay policy
 * (the user taps to unmute — PLAYBACK §9 / L-3.4).
 */
interface PlayerState {
  volume: number; // 0..100
  muted: boolean;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  toggleMuted: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  volume: 100,
  muted: true,
  // Nudging the volume implies the user wants to hear it → unmute.
  setVolume: (volume) =>
    set({ volume: Math.max(0, Math.min(100, Math.round(volume))), muted: false }),
  setMuted: (muted) => set({ muted }),
  toggleMuted: () => set((s) => ({ muted: !s.muted })),
}));
