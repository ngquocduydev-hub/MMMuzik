import type { MusicProvider, QueueItem, Track } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type QueueItemWithTrack = QueueItem & { track: Track };

// ── tracks (catalog, dedup by provider identity) ───────────────────────────
export function upsertTrack(input: {
  provider: MusicProvider;
  providerTrackId: string;
  title: string;
  thumbnailUrl: string | null;
}): Promise<Track> {
  return prisma.track.upsert({
    where: {
      provider_providerTrackId: {
        provider: input.provider,
        providerTrackId: input.providerTrackId,
      },
    },
    // On re-add, refresh title/thumbnail but KEEP a known duration.
    update: { title: input.title, thumbnailUrl: input.thumbnailUrl, resolvedAt: new Date() },
    create: {
      provider: input.provider,
      providerTrackId: input.providerTrackId,
      title: input.title,
      thumbnailUrl: input.thumbnailUrl,
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

export function count(roomId: string): Promise<number> {
  return prisma.queueItem.count({ where: { roomId } });
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
