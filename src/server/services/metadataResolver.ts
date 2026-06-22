import { logger } from '@/lib/logger';

export interface ResolvedMetadata {
  title: string;
  thumbnailUrl: string | null;
}

/**
 * Resolve YouTube metadata via oEmbed (no API key required) — title + thumbnail.
 * Duration is NOT available from oEmbed; it starts at 0 and is corrected by the
 * host player's `reportDuration` (PLAYBACK §7.5). Always returns something
 * usable (falls back to the id) so adding a track never hard-fails on metadata.
 */
export async function resolveYouTube(videoId: string): Promise<ResolvedMetadata> {
  const fallback: ResolvedMetadata = {
    title: videoId,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  };
  try {
    const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      `https://www.youtube.com/watch?v=${videoId}`,
    )}&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return fallback;
    const data = (await res.json()) as { title?: string; thumbnail_url?: string };
    return {
      title: data.title?.trim() || videoId,
      thumbnailUrl: data.thumbnail_url ?? fallback.thumbnailUrl,
    };
  } catch (err) {
    logger.warn({ err, videoId }, 'youtube oembed resolve failed; using fallback');
    return fallback;
  }
}
