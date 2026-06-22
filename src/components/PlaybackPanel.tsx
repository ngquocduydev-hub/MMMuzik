'use client';

import { useState } from 'react';
import { Music2, ExternalLink, RotateCw } from 'lucide-react';
import { usePlaybackStore } from '@/features/playback/store';
import { useQueueStore } from '@/features/queue/store';
import { YouTubePlayer } from '@/features/youtube/components/YouTubePlayer';
import { splitTrackTitle } from '@/lib/format';
import { classifySyncHealth } from '@/shared/domain/sync';
import { NowPlaying } from './playback/NowPlaying';
import { EmptyState } from '@/components/feedback/EmptyState';

const SYNC_LABEL: Record<string, string> = {
  good: 'In sync',
  unstable: 'Syncing…',
  bad: 'Out of sync',
};

/**
 * Now-playing stage (V1 §6). An aurora `surface-panel` whose centerpiece is the
 * embedded YouTube player with NATIVE controls — host drives, guests follow.
 * There is NO custom transport/seek/volume bar (V1); the host controls playback
 * directly on the video. Position is server-authoritative; this component owns no
 * sync logic. The "Retry" hatch remounts the player in place.
 */
export function PlaybackPanel() {
  const playback = usePlaybackStore((s) => s.playback);
  const rttMs = usePlaybackStore((s) => s.lastRttMs);
  const items = useQueueStore((s) => s.items);

  // Bump to remount (reload) the player in place — the "Retry" escape hatch.
  const [playerKey, setPlayerKey] = useState(0);

  const videoId = playback?.currentVideoId ?? null;
  const isPlaying = (playback?.status ?? 'idle') === 'playing';
  const hasTrack = !!playback?.currentTrackId;
  const hasVideo = !!videoId; // YouTube has a video; Spotify / none → artwork tile

  const currentItem = items.find((i) => i.id === playback?.currentTrackId) ?? null;
  const { primary, secondary } = currentItem
    ? splitTrackTitle(currentItem.title)
    : { primary: 'Nothing playing', secondary: null };
  const syncLabel = SYNC_LABEL[classifySyncHealth(rttMs)] ?? 'In sync';

  return (
    <section className="surface-panel relative overflow-hidden bg-aurora">
      {!hasTrack ? (
        <div className="p-5 sm:p-6">
          <EmptyState
            icon={<Music2 className="h-6 w-6" />}
            title="Nothing playing"
            description="Add a song to the queue to start the session."
            className="py-8"
          />
        </div>
      ) : hasVideo ? (
        <div className="flex flex-col gap-4">
          {/* Video fills the card edge-to-edge (the card's overflow-hidden rounds it). */}
          <YouTubePlayer key={playerKey} />

          <div className="flex flex-col gap-4 px-5 pb-5 sm:px-6 sm:pb-6">
            <NowPlaying
              title={primary}
              artist={secondary}
              provider={currentItem?.provider ?? 'youtube'}
              isPlaying={isPlaying}
              syncLabel={syncLabel}
            />

            {/* Escape hatch: YouTube can show an undetectable bot-wall inside the
                cross-origin iframe — always offer a way out (V1 §6.6). */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>Can&apos;t play here?</span>
              <a
                href={`https://www.youtube.com/watch?v=${videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-foreground/80 transition hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open on YouTube
              </a>
              <span aria-hidden>·</span>
              <button
                type="button"
                onClick={() => setPlayerKey((k) => k + 1)}
                className="inline-flex items-center gap-1 font-medium text-foreground/80 transition hover:text-foreground"
              >
                <RotateCw className="h-3.5 w-3.5" />
                Retry
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* No video (Spotify / metadata-only): padded card with an artwork tile. */
        <div className="p-5 sm:p-6">
          <NowPlaying
            title={primary}
            artist={secondary}
            provider={currentItem?.provider ?? 'youtube'}
            isPlaying={isPlaying}
            syncLabel={syncLabel}
            showArtwork
            artworkUrl={currentItem?.thumbnailUrl ?? null}
          />
        </div>
      )}
    </section>
  );
}
