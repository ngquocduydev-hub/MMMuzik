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
  /** The user has interacted with sound at least once. Until then we keep the
   *  autoplay-mute and unmute on the first gesture; after, manual mute sticks. */
  gestured: boolean;
  /** Show the video's captions/subtitles (CC). Per-client display preference. */
  captions: boolean;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  toggleMuted: () => void;
  setGestured: () => void;
  setCaptions: (captions: boolean) => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  volume: 100,
  muted: true,
  gestured: false,
  captions: false,
  // Nudging the volume implies the user wants to hear it → unmute.
  setVolume: (volume) =>
    set({ volume: Math.max(0, Math.min(100, Math.round(volume))), muted: false }),
  setMuted: (muted) => set({ muted }),
  toggleMuted: () => set((s) => ({ muted: !s.muted })),
  setGestured: () => set({ gestured: true }),
  setCaptions: (captions) => set({ captions }),
}));
