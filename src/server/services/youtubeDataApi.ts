import { getYouTubeApiKey } from '@/lib/config';
import { logger } from '@/lib/logger';
import type { SearchResultDto } from '@/shared/types';

/**
 * Authoritative YouTube metadata via the official Data API (`videos.list`).
 *
 * This is the protection-layer lookup (docs/features/youtube-in-app-search Phase 1)
 * — NOT search. One `videos.list` call (1 quota unit) yields the three signals the
 * sync engine needs that keyless oEmbed cannot provide:
 *   - contentDetails.duration  → authoritative finite duration at add time
 *   - snippet.liveBroadcastContent → livestream/premiere classification
 *   - status.embeddable / privacyStatus → can it actually play embedded for the room
 *
 * Server-side ONLY — the API key must never reach the client.
 */
export interface VideoDetails {
  /** False when the id returns no item (deleted / private / invalid). */
  exists: boolean;
  title: string;
  thumbnailUrl: string | null;
  /** Finite duration in ms; 0 when unknown or a livestream. */
  durationMs: number;
  /** status.embeddable !== false AND not private. */
  embeddable: boolean;
  /** liveBroadcastContent !== 'none' OR no positive finite duration. */
  isLivestream: boolean;
}

const DATA_API_URL = 'https://www.googleapis.com/youtube/v3/videos';
const ISO8601_DURATION = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;

/**
 * Parse an ISO-8601 duration (e.g. "PT3M33S", "PT1H2M", "P0D") to ms.
 * Returns 0 for "P0D"/empty (livestreams report these).
 */
export function parseIso8601DurationMs(iso: string): number {
  const m = ISO8601_DURATION.exec(iso.trim());
  if (!m) return 0;
  const [, d, h, min, s] = m;
  const days = Number(d ?? 0);
  const hours = Number(h ?? 0);
  const mins = Number(min ?? 0);
  const secs = Number(s ?? 0);
  return ((days * 24 + hours) * 3600 + mins * 60 + secs) * 1000;
}

interface VideosListItem {
  id?: string;
  snippet?: {
    title?: string;
    channelTitle?: string;
    liveBroadcastContent?: string;
    thumbnails?: Record<string, { url?: string }>;
  };
  contentDetails?: { duration?: string };
  status?: { embeddable?: boolean; privacyStatus?: string; uploadStatus?: string };
  statistics?: { viewCount?: string };
}

/** Pick the best available thumbnail, falling back to the canonical hqdefault URL. */
function pickThumbnail(item: VideosListItem, videoId: string): string {
  const t = item.snippet?.thumbnails;
  return (
    t?.medium?.url ??
    t?.high?.url ??
    t?.default?.url ??
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  );
}

/** Map a raw videos.list item to our normalized, guard-ready shape. */
export function classifyVideoItem(item: VideosListItem, videoId: string): VideoDetails {
  const live = item.snippet?.liveBroadcastContent ?? 'none';
  const durationMs = parseIso8601DurationMs(item.contentDetails?.duration ?? '');
  const isPrivate = item.status?.privacyStatus === 'private';
  const isLivestream = live !== 'none' || durationMs <= 0;
  return {
    exists: true,
    title: item.snippet?.title?.trim() || videoId,
    thumbnailUrl: pickThumbnail(item, videoId),
    durationMs: isLivestream ? 0 : durationMs,
    embeddable: item.status?.embeddable !== false && !isPrivate,
    isLivestream,
  };
}

/**
 * Fetch authoritative details for a single video. Returns `null` if the Data API
 * is not configured (no key) — callers then fall back to oEmbed. Throws on a hard
 * API/network failure so the add path can surface a typed error rather than queue a
 * blind item. A missing item (deleted/private) returns `{ exists: false }`.
 */
export async function fetchVideoDetails(videoId: string): Promise<VideoDetails | null> {
  const key = getYouTubeApiKey();
  if (!key) return null; // Data API disabled — caller falls back to oEmbed.

  const url =
    `${DATA_API_URL}?part=contentDetails,status,snippet` +
    `&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(key)}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) {
    logger.warn({ videoId, status: res.status }, 'youtube data api videos.list failed');
    throw new Error(`youtube data api responded ${res.status}`);
  }
  const data = (await res.json()) as { items?: VideosListItem[] };
  const item = data.items?.[0];
  if (!item) {
    return {
      exists: false,
      title: videoId,
      thumbnailUrl: null,
      durationMs: 0,
      embeddable: false,
      isLivestream: false,
    };
  }
  return classifyVideoItem(item, videoId);
}

const SEARCH_API_URL = 'https://www.googleapis.com/youtube/v3/search';

/** Map an enriched videos.list item to a search-result DTO (Phase 2). */
export function toSearchResult(item: VideosListItem): SearchResultDto {
  const videoId = item.id ?? '';
  const d = classifyVideoItem(item, videoId);
  const views = item.statistics?.viewCount ? Number(item.statistics.viewCount) : NaN;
  return {
    videoId,
    title: d.title,
    channelTitle: item.snippet?.channelTitle ?? '',
    thumbnailUrl: d.thumbnailUrl,
    durationMs: d.durationMs,
    viewCount: Number.isFinite(views) ? views : null,
    isLivestream: d.isLivestream,
    embeddable: d.embeddable,
    addable: d.exists && d.embeddable && !d.isLivestream,
  };
}

/**
 * Search YouTube and return enriched, guard-ready results (Phase 2). Two Data API
 * calls: `search.list` (type=video) for the page of ids, then ONE batched
 * `videos.list` to enrich every result with duration / embeddability / livestream
 * / view count — preserving search relevance order. Returns `null` when no API key
 * is configured (caller degrades to URL-paste). Throws on a hard API failure.
 *
 * Quota note: search.list is the expensive call (SEARCH_LIST_COST); the single
 * batched videos.list is cheap (SEARCH_ENRICH_COST). NEVER call per-result.
 */
export async function searchYouTube(
  query: string,
  maxResults: number,
): Promise<SearchResultDto[] | null> {
  const key = getYouTubeApiKey();
  if (!key) return null;

  const searchUrl =
    `${SEARCH_API_URL}?part=snippet&type=video&maxResults=${maxResults}` +
    `&q=${encodeURIComponent(query)}&key=${encodeURIComponent(key)}`;
  const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(6000) });
  if (!searchRes.ok) {
    logger.warn({ status: searchRes.status }, 'youtube data api search.list failed');
    throw new Error(`youtube data api search.list responded ${searchRes.status}`);
  }
  const searchData = (await searchRes.json()) as { items?: { id?: { videoId?: string } }[] };
  const ids = (searchData.items ?? [])
    .map((i) => i.id?.videoId)
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
  if (ids.length === 0) return [];

  const enrichUrl =
    `${DATA_API_URL}?part=contentDetails,status,snippet,statistics` +
    `&id=${ids.join(',')}&key=${encodeURIComponent(key)}`;
  const enrichRes = await fetch(enrichUrl, { signal: AbortSignal.timeout(6000) });
  if (!enrichRes.ok) {
    logger.warn({ status: enrichRes.status }, 'youtube data api videos.list (enrich) failed');
    throw new Error(`youtube data api videos.list responded ${enrichRes.status}`);
  }
  const enrichData = (await enrichRes.json()) as { items?: VideosListItem[] };
  const byId = new Map((enrichData.items ?? []).map((it) => [it.id ?? '', it]));
  // Preserve search relevance order; drop any id the enrich call didn't return.
  return ids
    .map((id) => byId.get(id))
    .filter((it): it is VideosListItem => it !== undefined)
    .map(toSearchResult);
}
