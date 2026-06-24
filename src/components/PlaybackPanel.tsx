'use client';

import { Music2 } from 'lucide-react';
import { usePlaybackStore } from '@/features/playback/store';
import { useQueueStore } from '@/features/queue/store';
import { YouTubePlayer } from '@/features/youtube/components/YouTubePlayer';
import { EmptyState } from '@/components/feedback/EmptyState';

/**
 * Now-playing stage — JUST the video, full-bleed (no title / sync / provider / hatch
 * chrome on the frame; the current track is shown + highlighted in the Queue). The
 * YouTube player is server-authoritative and non-interactive; only the in-frame
 * volume/CC controls and the error overlay (on a play error) sit on top of it.
 */
export function PlaybackPanel() {
  const playback = usePlaybackStore((s) => s.playback);
  const items = useQueueStore((s) => s.items);

  const videoId = playback?.currentVideoId ?? null;
  const hasTrack = !!playback?.currentTrackId;
  const currentItem = items.find((i) => i.id === playback?.currentTrackId) ?? null;

  if (!hasTrack) {
    return (
      <section className="surface-panel relative overflow-hidden bg-aurora">
        <div className="p-5 sm:p-6">
          <EmptyState
            icon={<Music2 className="h-6 w-6" />}
            title="Nothing playing"
            description="Add a song to the queue to start the session."
            className="py-8"
          />
        </div>
      </section>
    );
  }

  return (
    <section className="surface-panel relative overflow-hidden bg-black">
      {videoId ? (
        <YouTubePlayer />
      ) : currentItem?.thumbnailUrl ? (
        // Metadata-only (e.g. Spotify): the artwork fills the frame, no text.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={currentItem.thumbnailUrl} alt="" className="aspect-video w-full object-cover" />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center bg-surface-2 text-muted-foreground">
          <Music2 className="h-8 w-8" />
        </div>
      )}
    </section>
  );
}
