import type { MusicProvider, QueueItem, Track } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type QueueItemWithTrack = QueueItem & { track: Track };

// ── tracks (catalog, dedup by provider identity) ───────────────────────────
export function upsertTrack(input: {
  provider: MusicProvider;
  providerTrackId: string;
  title: string;
  thumbnailUrl: string | null;
  /** Authoritative duration (ms) when known at add time (Data API). 0/undefined
   *  leaves the placeholder and waits for the host player's reportDuration. */
  durationMs?: number;
}): Promise<Track> {
  const knownDuration =
    input.durationMs && input.durationMs > 0 ? BigInt(Math.trunc(input.durationMs)) : null;
  return prisma.track.upsert({
    where: {
      provider_providerTrackId: {
        provider: input.provider,
        providerTrackId: input.providerTrackId,
      },
    },
    // On re-add, refresh title/thumbnail; set duration only when newly known
    // (never clobber a known duration with 0).
    update: {
      title: input.title,
      thumbnailUrl: input.thumbnailUrl,
      resolvedAt: new Date(),
      ...(knownDuration !== null ? { durationMs: knownDuration } : {}),
    },
    create: {
      provider: input.provider,
      providerTrackId: input.providerTrackId,
      title: input.title,
      thumbnailUrl: input.thumbnailUrl,
      ...(knownDuration !== null ? { durationMs: knownDuration } : {}),
    },
  });
}

export async function updateTrackDuration(trackId: string, durationMs: number): Promise<void> {
  await prisma.track.update({
    where: { id: trackId },
    data: { durationMs: BigInt(Math.trunc(durationMs)) },
  });
}

// ── queue items (ordered by position) ──────────────────────────────────────
export function listItems(roomId: string): Promise<QueueItemWithTrack[]> {
  return prisma.queueItem.findMany({
    where: { roomId },
    orderBy: { position: 'asc' },
    include: { track: true },
  });
}

export function findItem(roomId: string, itemId: string): Promise<QueueItemWithTrack | null> {
  return prisma.queueItem.findFirst({ where: { roomId, id: itemId }, include: { track: true } });
}

/**
 * Map of queue-item id → track title for the given ids, in one query. Used by the
 * public-room list to resolve each room's now-playing title without N+1.
 */
export async function findTitlesByItemIds(itemIds: string[]): Promise<Map<string, string>> {
  if (itemIds.length === 0) return new Map();
  const items = await prisma.queueItem.findMany({
    where: { id: { in: itemIds } },
    select: { id: true, track: { select: { title: true } } },
  });
  return new Map(items.map((i) => [i.id, i.track.title]));
}

export function count(roomId: string): Promise<number> {
  return prisma.queueItem.count({ where: { roomId } });
}

/**
 * Count a session's UPCOMING items — those strictly after `afterPosition` (the
 * current track's position; pass -1 when idle so all items count). Matches the
 * "up next" semantics of features/queue/selectors (played items linger but don't
 * count). Used for the per-user anti-domination cap.
 */
export function countUpcomingBySession(
  roomId: string,
  sessionId: string,
  afterPosition: number,
): Promise<number> {
  return prisma.queueItem.count({
    where: { roomId, addedBySessionId: sessionId, position: { gt: afterPosition } },
  });
}

/**
 * Find the first current-or-upcoming queue item for a given provider track id —
 * items at or after `fromPosition` (pass the current position to include the
 * playing track; 0 when idle). Used for warn-not-block duplicate detection.
 */
export function findActiveByVideoId(
  roomId: string,
  provider: MusicProvider,
  providerTrackId: string,
  fromPosition: number,
): Promise<QueueItemWithTrack | null> {
  return prisma.queueItem.findFirst({
    where: {
      roomId,
      position: { gte: fromPosition },
      track: { provider, providerTrackId },
    },
    orderBy: { position: 'asc' },
    include: { track: true },
  });
}

export async function addItemAtTail(
  roomId: string,
  trackId: string,
  addedBySessionId: string,
  addedByNickname: string,
): Promise<QueueItemWithTrack> {
  const max = await prisma.queueItem.aggregate({ where: { roomId }, _max: { position: true } });
  const position = (max._max.position ?? -1) + 1;
  return prisma.queueItem.create({
    data: { roomId, trackId, position, addedBySessionId, addedByNickname },
    include: { track: true },
  });
}

/** Delete an item and recompact remaining positions to 0..n-1 (atomic). */
export async function removeItem(roomId: string, itemId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.queueItem.deleteMany({ where: { roomId, id: itemId } });
    const items = await tx.queueItem.findMany({ where: { roomId }, orderBy: { position: 'asc' } });
    await Promise.all(
      items.map((it, i) =>
        it.position === i
          ? Promise.resolve()
          : tx.queueItem.update({ where: { id: it.id }, data: { position: i } }),
      ),
    );
  });
}

/** Set positions to match the given order (atomic). Caller validates the set. */
export async function reorder(roomId: string, orderedIds: string[]): Promise<void> {
  await prisma.$transaction(
    orderedIds.map((id, i) =>
      prisma.queueItem.updateMany({ where: { roomId, id }, data: { position: i } }),
    ),
  );
}

export async function clear(roomId: string): Promise<void> {
  await prisma.queueItem.deleteMany({ where: { roomId } });
}

/** The item immediately after `currentItemId` by position; first if current is absent. */
export async function nextItemAfter(
  roomId: string,
  currentItemId: string,
): Promise<QueueItemWithTrack | null> {
  const items = await listItems(roomId);
  const idx = items.findIndex((it) => it.id === currentItemId);
  if (idx === -1) return items[0] ?? null;
  return items[idx + 1] ?? null;
}
