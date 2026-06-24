'use client';

import { useEffect, useRef, useState } from 'react';
import { usePlaybackStore } from '@/features/playback/store';
import { usePlayerStore } from '@/features/playback/playerStore';
import { useRoomStore } from '@/features/room/store';
import { getSocket } from '@/lib/socket-client';
import { VolumeControl } from './VolumeControl';
import { computeExpectedPosition } from '@/shared/domain/playback';
import { shouldHardSeek } from '@/shared/domain/reconcile';
import { RECONCILE_TICK_MS } from '@/shared/constants';
import { loadYouTubeIframeApi, toPlayerPhase } from '@/lib/youtube';

const PROGRAMMATIC_GUARD_MS = 800;

/**
 * YouTube IFrame error codes that mean the current video can NEVER play here
 * (invalid id, removed/private, embedding disabled) — as opposed to a possibly
 * transient HTML5 glitch (5). On these, the HOST asks the server to auto-skip so
 * the whole room isn't stranded (docs/features/youtube-in-app-search Phase 1).
 */
const UNPLAYABLE_ERROR_CODES = new Set([2, 100, 101, 150]);

/**
 * True only when the browser reports it will allow audible autoplay right now
 * (Chrome/Firefox `getAutoplayPolicy`). When true we can unmute immediately on
 * join without the browser pausing us; otherwise we stay muted and rely on the
 * first-gesture / "Tap to enable sound" fallback. Returns false where the API is
 * unavailable — the safe default.
 */
function soundAutoplayAllowed(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { getAutoplayPolicy?: (type: string) => string };
  try {
    return nav.getAutoplayPolicy?.('mediaelement') === 'allowed';
  } catch {
    return false;
  }
}

/**
 * YouTube renderer — a PURE, NON-INTERACTIVE follower of the server playback
 * anchor. Nobody (host or guest) controls the video directly: native controls
 * are off (`controls:0`, `disablekb:1`) AND a transparent overlay blocks every
 * pointer interaction with the iframe. Playback is fully server-driven — autoplay
 * on join, auto-advance on track end, and the host's queue **Skip** — so the room
 * stays perfectly in sync and no one can pause/seek the video.
 *
 * The component still performs two HOST-only background reports (never user
 * interactions): the real track duration and the ENDED accelerator for auto-next.
 * Host vs guest is resolved live from the store, so a host transfer needs no
 * remount. Position is always computed from the anchor + clock offset.
 */
export function YouTubePlayer() {
  const videoId = usePlaybackStore((s) => s.playback?.currentVideoId ?? null);
  const status = usePlaybackStore((s) => s.playback?.status ?? 'idle');
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const setMuted = usePlayerStore((s) => s.setMuted);
  const gestured = usePlayerStore((s) => s.gestured);
  const setGestured = usePlayerStore((s) => s.setGestured);

  const mountRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const loadedIdRef = useRef<string | null>(null);
  const lastSeekAtRef = useRef(0);
  const reportedItemRef = useRef<string | null>(null);
  // Suppress reconcile actions triggered by our OWN programmatic player calls.
  const programmaticUntilRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [errorCode, setErrorCode] = useState<number | null>(null);

  /** Expected position (ms) from the server anchor + clock offset — the truth. */
  const expectedMs = (): number => {
    const { playback, clockOffsetMs } = usePlaybackStore.getState();
    return playback ? computeExpectedPosition(playback, Date.now() + clockOffsetMs) : 0;
  };

  const markProgrammatic = () => {
    programmaticUntilRef.current = Date.now() + PROGRAMMATIC_GUARD_MS;
  };
  const isProgrammatic = () => Date.now() < programmaticUntilRef.current;

  /**
   * HOST-only background reports (NOT user interactions): correct the real track
   * duration, and accelerate auto-next when the video ends. Reads live store
   * state so the (mount-time) closure never goes stale across a host transfer.
   */
  const handleStateChange = (state: number) => {
    const { playback } = usePlaybackStore.getState();
    const { room, session } = useRoomStore.getState();
    const roomId = room?.id;
    const itemId = playback?.currentTrackId ?? null;
    const host = !!room && !!session && room.hostSessionId === session.id;
    if (!roomId || !host || !itemId) return;

    if (state === 1 /* PLAYING */) {
      const dur = playerRef.current?.getDuration?.() ?? 0;
      if (dur > 0 && reportedItemRef.current !== itemId) {
        reportedItemRef.current = itemId;
        getSocket().emit(
          'playback:reportDuration',
          { roomId, queueItemId: itemId, durationMs: Math.round(dur * 1000) },
          () => {},
        );
      }
    } else if (state === 0 /* ENDED */) {
      getSocket().emit('playback:trackEnded', { roomId, endedItemId: itemId }, () => {});
    }
  };

  /**
   * Player error. Always surface the local overlay (Open on YouTube + Retry). If
   * the viewer is the HOST and the video is permanently unplayable, ask the server
   * to auto-skip so the whole room recovers — a guest's error stays local only.
   */
  const handleError = (code: number) => {
    setErrorCode(code);
    if (!UNPLAYABLE_ERROR_CODES.has(code)) return;
    const { playback } = usePlaybackStore.getState();
    const { room, session } = useRoomStore.getState();
    const roomId = room?.id;
    const itemId = playback?.currentTrackId ?? null;
    const host = !!room && !!session && room.hostSessionId === session.id;
    if (host && roomId && itemId) {
      getSocket().emit('playback:trackError', { roomId, itemId }, () => {});
    }
  };

  const loadCurrent = (id: string) => {
    const player = playerRef.current;
    if (!player) return;
    setErrorCode(null);
    loadedIdRef.current = id;
    lastSeekAtRef.current = Date.now();
    markProgrammatic();
    // Atomic load+seek so it never sticks "loaded but paused" (PLAYBACK §9.2).
    player.loadVideoById({ videoId: id, startSeconds: expectedMs() / 1000 });
  };

  // ── create the persistent, non-interactive player once ──────────────────────
  useEffect(() => {
    let cancelled = false;
    let player: YT.Player | null = null;
    loadYouTubeIframeApi()
      .then((YTApi) => {
        if (cancelled || !mountRef.current) return;
        player = new YTApi.Player(mountRef.current, {
          width: '100%',
          height: '100%',
          playerVars: {
            controls: 0, // no native controls — nobody drives the video directly
            disablekb: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            mute: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              playerRef.current = player;
              setReady(true);
              // Enable sound immediately when the browser allows audible autoplay;
              // otherwise stay muted (the gesture / "Tap to enable sound" fallback).
              if (soundAutoplayAllowed()) usePlayerStore.getState().setMuted(false);
            },
            onStateChange: (e) => handleStateChange(e.data),
            onError: (e) => handleError(e.data),
          },
        });
      })
      .catch(() => setErrorCode(-1));
    return () => {
      cancelled = true;
      try {
        player?.destroy();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
    };
    // handleStateChange is intentionally captured at mount (it reads live store
    // state via getState, so it never goes stale).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── load on videoId change ───────────────────────────────────────────────────
  useEffect(() => {
    if (!ready || !videoId) return;
    if (loadedIdRef.current === videoId) return;
    loadCurrent(videoId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, videoId]);

  // ── match the server status (play / pause-on-idle) — programmatic-guarded ────
  useEffect(() => {
    const player = playerRef.current;
    if (!ready || !player || !videoId) return;
    markProgrammatic();
    if (status === 'playing') player.playVideo();
    else player.pauseVideo();
  }, [ready, status, videoId]);

  // ── apply local volume/mute (per-client listening preference, not server state) ──
  useEffect(() => {
    const player = playerRef.current;
    if (!ready || !player) return;
    try {
      player.setVolume(volume);
      if (muted) player.mute();
      else player.unMute();
    } catch {
      /* player not ready for volume yet — the next change re-applies */
    }
  }, [ready, volume, muted]);

  // ── follow the anchor: re-assert play + drift-reconcile (unchanged engine) ───
  useEffect(() => {
    if (!ready) return;
    const tick = () => {
      const player = playerRef.current;
      const { playback } = usePlaybackStore.getState();
      if (!player || !playback || !playback.currentVideoId || isProgrammatic()) return;
      if (playback.status !== 'playing') return;
      const phase = toPlayerPhase(player.getPlayerState?.() ?? -1);
      // Nobody may pause the video — if it ever ends up paused while the server is
      // playing (browser policy, etc.), resume it.
      if (phase === 'paused') {
        markProgrammatic();
        player.playVideo();
        return;
      }
      const playerPosMs = (player.getCurrentTime?.() ?? 0) * 1000;
      const driftMs = playerPosMs - expectedMs();
      if (
        shouldHardSeek({
          driftMs,
          playerPhase: phase,
          msSinceLastSeek: Date.now() - lastSeekAtRef.current,
        })
      ) {
        markProgrammatic();
        player.seekTo(expectedMs() / 1000, true);
        lastSeekAtRef.current = Date.now();
      }
    };
    const id = setInterval(tick, RECONCILE_TICK_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [ready]);

  // ── §6.6: restore sound on the first user gesture anywhere (muted autoplay) ──
  // Only until the user has interacted once; afterwards a manual mute must stick.
  useEffect(() => {
    if (!ready || !muted || gestured) return;
    const unmute = () => {
      setMuted(false);
      setGestured();
    };
    window.addEventListener('pointerdown', unmute, { once: true });
    window.addEventListener('keydown', unmute, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unmute);
      window.removeEventListener('keydown', unmute);
    };
  }, [ready, muted, gestured, setMuted, setGestured]);

  // 16:9, full width, edge-to-edge. The box ALWAYS keeps a true 16:9 ratio so the
  // iframe matches the video and never pillarboxes (black bars). Height is bounded
  // by capping the WIDTH (height = width × 9/16) instead of the height — a plain
  // `max-h` would squash the box wider-than-16:9 and YouTube would letterbox inside
  // it. Base cap 133.33vh ≈ 75vh tall: the mobile tab and the tablet column give the
  // player its own scroll space, so it can be large there. On desktop (lg) the 3-col
  // layout stacks the queue UNDER the player in the SAME column — a 75vh player left
  // the queue a ~60px sliver (header only) — so there we tighten to 100vh ≈ 56vh tall
  // so the queue always keeps a usable, scrollable area. The cap engages only on
  // wide/short viewports (the 16:9 video then centers with the aurora at the sides);
  // narrower viewports fill the full container width.
  return (
    <div className="relative mx-auto aspect-video w-full max-w-[133.33vh] overflow-hidden bg-black lg:max-w-[100vh]">
      {/* The YT API replaces this node with its iframe. */}
      <div ref={mountRef} className="h-full w-full" />

      {/*
        Locked: a transparent overlay swallows EVERY pointer interaction with the
        video for everyone — host and guests alike — so nobody can play/pause/seek
        by clicking the iframe (`controls:0` alone still allows click-to-pause).
        Clicks are NOT stopped from bubbling, so the first-gesture unmute still
        fires. Sits below the unmute button (z-10) and the error overlay (z-20).
      */}
      <div className="absolute inset-0 z-[2]" aria-hidden />

      {/* Loading poster until the player paints — avoids a black flash (V1 §6.6). */}
      {videoId && !ready && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {videoId && errorCode === null && <VolumeControl />}

      {errorCode !== null && videoId && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/85 text-center text-sm">
          <p className="text-slate-200">This video can’t be played here.</p>
          <div className="flex gap-2">
            <a
              href={`https://www.youtube.com/watch?v=${videoId}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white"
            >
              Open on YouTube ↗
            </a>
            <button
              onClick={() => loadCurrent(videoId)}
              className="rounded-lg border border-slate-500 px-3 py-1.5 text-xs text-slate-200"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
