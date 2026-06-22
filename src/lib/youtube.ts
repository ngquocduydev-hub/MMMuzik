/// <reference types="youtube" />

/**
 * Lazy, singleton loader for the YouTube IFrame Player API. The script is added
 * once; subsequent calls reuse the same promise. We never proxy audio — we
 * embed YouTube's own player and synchronize control + position (PLAYBACK §9).
 */
declare global {
  interface Window {
    YT?: typeof YT;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<typeof YT> | null = null;

export function loadYouTubeIframeApi(): Promise<typeof YT> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('YouTube API requires a browser'));
  }
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<typeof YT>((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT!);
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
  return apiPromise;
}

/** Map the YT.PlayerState number to our pure `PlayerPhase` union. */
export function toPlayerPhase(state: number): import('@/shared/domain/reconcile').PlayerPhase {
  switch (state) {
    case 1:
      return 'playing';
    case 2:
      return 'paused';
    case 3:
      return 'buffering';
    case 5:
      return 'cued';
    case 0:
      return 'ended';
    default:
      return 'unstarted';
  }
}
