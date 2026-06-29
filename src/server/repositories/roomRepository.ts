import { Prisma, type Room, type Participant, type RoomVisibility } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { PlaybackAnchor } from '@/shared/domain/playback';

/** All Room/Participant DB access + the embedded playback anchor read/write. */

export function createRoom(data: {
  code: string;
  name: string;
  visibility: RoomVisibility;
  hostSessionId: string;
  host: { sessionId: string; nickname: string; avatar: string | null };
}): Promise<Room> {
  return prisma.room.create({
    data: {
      code: data.code,
      name: data.name,
      visibility: data.visibility,
      hostSessionId: data.hostSessionId,
      status: 'active',
      participants: {
        create: {
          sessionId: data.host.sessionId,
          nickname: data.host.nickname,
          avatar: data.host.avatar,
          role: 'host',
        },
      },
    },
  });
}

/**
 * Rooms for the browse list, most-recently-active first. Includes BOTH public and
 * private rooms (private are rendered locked by the UI); only closed rooms are
 * excluded. active OR idle (empty-but-alive) — a room stays discoverable after its
 * creator leaves, until the reaper removes it. Returns each room with its CURRENT
 * online-participant count (one grouped query — no N+1).
 */
export async function listPublicRooms(
  limit: number,
): Promise<Array<Room & { onlineCount: number }>> {
  const rooms = await prisma.room.findMany({
    where: { status: { in: ['active', 'idle'] } },
    orderBy: { lastActivityAt: 'desc' },
    take: limit,
  });
  if (rooms.length === 0) return [];

  const counts = await prisma.participant.groupBy({
    by: ['roomId'],
    where: { roomId: { in: rooms.map((r) => r.id) }, isOnline: true },
    _count: { _all: true },
  });
  const onlineByRoom = new Map(counts.map((c) => [c.roomId, c._count._all]));
  return rooms.map((r) => ({ ...r, onlineCount: onlineByRoom.get(r.id) ?? 0 }));
}

export function findRoomById(id: string): Promise<Room | null> {
  return prisma.room.findUnique({ where: { id } });
}

export function findRoomByCode(code: string): Promise<Room | null> {
  return prisma.room.findUnique({ where: { code } });
}

export function findParticipants(roomId: string): Promise<Participant[]> {
  return prisma.participant.findMany({ where: { roomId }, orderBy: { joinedAt: 'asc' } });
}

export function findParticipant(roomId: string, sessionId: string): Promise<Participant | null> {
  return prisma.participant.findUnique({ where: { roomId_sessionId: { roomId, sessionId } } });
}

export function countParticipants(roomId: string): Promise<number> {
  return prisma.participant.count({ where: { roomId } });
}

export async function addParticipant(
  roomId: string,
  p: { sessionId: string; nickname: string; avatar: string | null; role?: 'host' | 'member' },
): Promise<Participant> {
  const [participant] = await prisma.$transaction([
    prisma.participant.create({
      data: {
        roomId,
        sessionId: p.sessionId,
        nickname: p.nickname,
        avatar: p.avatar,
        role: p.role ?? 'member',
      },
    }),
    // A join is activity — keep the room out of the reaper's grace window.
    prisma.room.update({ where: { id: roomId }, data: { lastActivityAt: new Date() } }),
  ]);
  return participant;
}

// ── embedded playback anchor (pb_*) ──────────────────────────────────────
export function toAnchor(room: Room): PlaybackAnchor {
  return {
    status: room.pbStatus,
    currentTrackId: room.pbCurrentItemId,
    currentVideoId: room.pbCurrentVideoId,
    positionMs: Number(room.pbPositionMs),
    updatedAtUtc: room.pbUpdatedAt.getTime(),
    revision: Number(room.pbRevision),
  };
}

/**
 * Optimistic-concurrency update of the playback anchor. Returns false on a
 * version conflict (caller reloads + retries). Bumps `version` + `lastActivityAt`.
 */
export async function updatePlaybackAnchor(
  roomId: string,
  expectedVersion: number,
  anchor: PlaybackAnchor,
  currentDurationMs?: number,
): Promise<boolean> {
  const data: Prisma.RoomUpdateManyMutationInput = {
    pbStatus: anchor.status,
    pbCurrentItemId: anchor.currentTrackId,
    pbCurrentVideoId: anchor.currentVideoId,
    pbPositionMs: BigInt(Math.trunc(anchor.positionMs)),
    pbUpdatedAt: new Date(anchor.updatedAtUtc),
    pbRevision: BigInt(anchor.revision),
    version: { increment: 1 },
    lastActivityAt: new Date(),
  };
  // Only set duration on track transitions (play/advance/idle), not play/pause/seek.
  if (currentDurationMs !== undefined) {
    data.pbCurrentDurationMs = BigInt(Math.trunc(currentDurationMs));
  }
  const res = await prisma.room.updateMany({
    where: { id: roomId, version: expectedVersion },
    data,
  });
  return res.count === 1;
}

/** Update the current track's duration without re-anchoring (host duration report). */
export async function setCurrentDuration(roomId: string, durationMs: number): Promise<void> {
  await prisma.room.update({
    where: { id: roomId },
    data: { pbCurrentDurationMs: BigInt(Math.trunc(durationMs)) },
  });
}

export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

// ── presence + membership + host transfer (Phase 4) ────────────────────────
export async function setOnline(roomId: string, sessionId: string, online: boolean): Promise<void> {
  const now = new Date();
  await prisma.$transaction([
    prisma.participant.updateMany({
      where: { roomId, sessionId },
      data: { isOnline: online, lastSeenAt: now, disconnectedAt: online ? null : now },
    }),
    // Presence change is activity — measures the reaper's grace from the last
    // connect/disconnect so a just-emptied room isn't deleted prematurely.
    prisma.room.update({ where: { id: roomId }, data: { lastActivityAt: now } }),
  ]);
}

export async function removeParticipant(roomId: string, sessionId: string): Promise<void> {
  await prisma.participant.deleteMany({ where: { roomId, sessionId } });
}

export async function closeRoom(roomId: string): Promise<void> {
  await prisma.room.update({
    where: { id: roomId },
    data: { status: 'closed', closedAt: new Date() },
  });
}

/**
 * Empty room → Idle (REQ-HOST-5): alive but no participants; reaper cleans up
 * later. Bumps `lastActivityAt` so the inactivity grace measures from the moment
 * the room became empty — a room you just left stays discoverable for the full
 * grace window regardless of how long you sat in it.
 */
export async function setRoomIdle(roomId: string): Promise<void> {
  await prisma.room.update({
    where: { id: roomId },
    data: { status: 'idle', lastActivityAt: new Date() },
  });
}

/** Idle → Active when someone joins (SPEC §5.1). */
export async function reactivateRoom(roomId: string): Promise<void> {
  await prisma.room.update({ where: { id: roomId }, data: { status: 'active' } });
}

/**
 * Reset all presence to offline. Called once at server startup: a fresh process
 * has zero live sockets, so any lingering `is_online=true` is stale (e.g. from a
 * crash/restart) and would otherwise show phantom listeners and block the reaper.
 * Real clients re-mark themselves online on (re)connect.
 *
 * NOTE: single-instance assumption (the current compose topology). Multi-instance
 * presence reconciliation via Redis is future hardening (ARCHITECTURE future work).
 */
export async function markAllParticipantsOffline(): Promise<number> {
  const res = await prisma.participant.updateMany({
    where: { isOnline: true },
    data: { isOnline: false, disconnectedAt: new Date() },
  });
  return res.count;
}

// ── inactive-room reaper (auto-cleanup job) ────────────────────────────────
/**
 * Ids of rooms with NO online participants whose last activity predates
 * `threshold` — the auto-cleanup candidates. Excludes already-closed rooms.
 */
export async function findReapableRoomIds(threshold: Date): Promise<string[]> {
  const rooms = await prisma.room.findMany({
    where: {
      status: { not: 'closed' },
      lastActivityAt: { lt: threshold },
      participants: { none: { isOnline: true } },
    },
    select: { id: true },
  });
  return rooms.map((r) => r.id);
}

/**
 * Hard-delete rooms by id. Cascades to participants / queue_items / chat_messages
 * (all `onDelete: Cascade`); Track rows are retained. Returns the count deleted.
 */
export async function deleteRooms(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const res = await prisma.room.deleteMany({ where: { id: { in: ids } } });
  return res.count;
}

/**
 * Promote `newHostSessionId` to host: demote the current host to member, set the
 * new participant's role to host, and update the room's authoritative pointer —
 * all in one transaction so there is never zero or two hosts.
 */
export async function transferHost(roomId: string, newHostSessionId: string): Promise<void> {
  await prisma.$transaction([
    prisma.participant.updateMany({ where: { roomId, role: 'host' }, data: { role: 'member' } }),
    prisma.participant.updateMany({
      where: { roomId, sessionId: newHostSessionId },
      data: { role: 'host' },
    }),
    prisma.room.update({ where: { id: roomId }, data: { hostSessionId: newHostSessionId } }),
  ]);
}
