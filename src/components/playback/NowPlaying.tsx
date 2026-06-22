import { Music2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SoundBars } from '@/components/feedback/SoundBars';
import { cn } from '@/lib/utils';

/**
 * Track metadata block (V1 §6.3). Provider badge + an animated "In sync"
 * indicator (driven by V2's real sync health) + title/artist. When a YouTube
 * video is present the video itself is the artwork, so `showArtwork` is false;
 * for Spotify / metadata-only it renders a cover tile (image or brand gradient).
 */
export function NowPlaying({
  title,
  artist,
  provider,
  isPlaying,
  syncLabel,
  showArtwork = false,
  artworkUrl = null,
}: {
  title: string;
  artist: string | null;
  provider: 'youtube' | 'spotify' | null;
  isPlaying: boolean;
  syncLabel: string;
  showArtwork?: boolean;
  artworkUrl?: string | null;
}) {
  const meta = (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center gap-2">
        {provider && (
          <Badge variant="secondary">{provider === 'spotify' ? 'Spotify' : 'YouTube'}</Badge>
        )}
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
          <SoundBars playing={isPlaying} />
          {syncLabel}
        </span>
      </div>
      <h2
        className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg"
        title={title}
      >
        {title}
      </h2>
      {artist && (
        <p className="truncate text-xs text-muted-foreground" title={artist}>
          {artist}
        </p>
      )}
    </div>
  );

  if (!showArtwork) return meta;

  return (
    <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl shadow-glow sm:h-40 sm:w-40">
        {artworkUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={artworkUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className={cn(
              'flex h-full w-full items-center justify-center text-white',
              'bg-gradient-to-br from-primary/40 to-accent/40',
            )}
          >
            <Music2 className="h-8 w-8" />
          </div>
        )}
      </div>
      {meta}
    </div>
  );
}
