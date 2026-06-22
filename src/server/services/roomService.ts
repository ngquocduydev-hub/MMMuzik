import { randomInt } from 'node:crypto';
import type { Room, Participant, Session } from '@prisma/client';
import { generateRoomCode, dedupeNickname } from '@/shared/domain/room';
import { AppError, ERRORS } from '@/shared/errors';
import { ROOM_CODE_MAX_ATTEMPTS, ROOM_MAX_PARTICIPANTS } from '@/shared/constants';
import type { RoomSummaryDto } from '@/shared/types';
import * as roomRepo from '@/server/repositories/roomRepository';
import * as queueRepo from '@/server/repositories/queueRepository';

/** Crypto-backed random in [0,1) for unbiased code generation. */
const cryptoRand = (): number => randomInt(0, 1_000_000) / 1_000_000;

/**
 * Create a room: generate a unique human-friendly code (retry on collision),
 * the creator becomes HOST + first participant.
 */
export async function createRoom(
  input: { name: string; nickname: string; avatar: string | null },
  sessionId: string,
): Promise<{ room: Room; participant: Participant }> {
  for (let attempt = 0; attempt < ROOM_CODE_MAX_ATTEMPTS; attempt++) {
    const code = generateRoomCode(cryptoRand);
    if (await roomRepo.findRoomByCode(code)) continue; // pre-check (cheap)
    try {
      const room = await roomRepo.createRoom({
        code,
        name: input.name,
        hostSessionId: sessionId,
        host: { sessionId, nickname: input.nickname, avatar: input.avatar },
      });
      const participant = await roomRepo.findParticipant(room.id, sessionId);
      return { room, participant: participant! };
    } catch (err) {
      if (roomRepo.isUniqueViolation(err)) continue; // race on code → retry
      throw err;
    }
  }
  throw new AppError(ERRORS.ROOM_CODE_GENERATION_FAILED, 'Could not generate a unique room code');
}

/**
 * Join an ACTIVE room. Idempotent for an existing participant. Enforces the
 * 50-participant cap and de-duplicates nicknames per room (FR-2.4).
 */
export async function joinRoom(
  input: { code: string; nickname?: string; avatar: string | null },
  session: Pick<Session, 'id' | 'displayName' | 'avatar'>,
): Promise<{ room: Room; participant: Participant }> {
  // Normalize defensively (callers other than the zod-validated API may pass raw).
  const code = input.code.trim().toUpperCase();
  const room = await roomRepo.findRoomByCode(code);
  if (!room) throw new AppError(ERRORS.ROOM_NOT_FOUND, 'Room not found');
  if (room.status === 'closed') throw new AppError(ERRORS.ROOM_CLOSED, 'This room has ended');

  const existing = await roomRepo.findParticipant(room.id, session.id);
  if (existing) return { room, participant: existing }; // rejoin — no duplicate

  if ((await roomRepo.countParticipants(room.id)) >= ROOM_MAX_PARTICIPANTS) {
    throw new AppError(ERRORS.ROOM_FULL, 'This room is full');
  }

  const participants = await roomRepo.findParticipants(room.id);
  const desired = (input.nickname ?? session.displayName).trim();
  const nickname = dedupeNickname(
    desired,
    participants.map((p) => p.nickname),
  );
  const participant = await roomRepo.addParticipant(room.id, {
    sessionId: session.id,
    nickname,
    avatar: input.avatar ?? session.avatar,
    role: 'member',
  });
  return { room, participant };
}

export async function getRoom(roomId: string): Promise<Room> {
  const room = await roomRepo.findRoomById(roomId);
  if (!room) throw new AppError(ERRORS.ROOM_NOT_FOUND, 'Room not found');
  return room;
}

/**
 * Pre-join summary by code (for the invite/join screen). A closed or unknown
 * code is reported as not-found (a guest cannot join either). `listenerCount`
 * is the online participant count; `nowPlayingTitle` resolves the current track.
 */
export async function getRoomSummaryByCode(code: string): Promise<RoomSummaryDto> {
  const room = await roomRepo.findRoomByCode(code.trim().toUpperCase());
  if (!room || room.status === 'closed') {
    throw new AppError(ERRORS.ROOM_NOT_FOUND, "This room doesn't exist or has closed.");
  }
  const participants = await roomRepo.findParticipants(room.id);
  let nowPlayingTitle: string | null = null;
  if (room.pbCurrentItemId) {
    const item = await queueRepo.findItem(room.id, room.pbCurrentItemId);
    nowPlayingTitle = item?.track.title ?? null;
  }
  return {
    id: room.id,
    code: room.code,
    name: room.name,
    listenerCount: participants.filter((p) => p.isOnline).length,
    nowPlayingTitle,
  };
}

export function listParticipants(roomId: string): Promise<Participant[]> {
  return roomRepo.findParticipants(roomId);
}

export interface LeaveResult {
  roomClosed: boolean;
  hostChanged: boolean;
  newHostSessionId: string | null;
}

/**
 * Explicit leave: remove the participant. If they were host and others remain,
 * transfer to the longest-present remaining participant (prefer online). If no
 * one remains, close the room. A room always has exactly one host (SPEC §7.10).
 */
export async function leaveRoom(roomId: string, sessionId: string): Promise<LeaveResult> {
  const participant = await roomRepo.findParticipant(roomId, sessionId);
  if (!participant) throw new AppError(ERRORS.PARTICIPANT_NOT_FOUND, 'You are not in this room');

  const wasHost = participant.role === 'host';
  await roomRepo.removeParticipant(roomId, sessionId);

  const remaining = await roomRepo.findParticipants(roomId); // ordered joinedAt asc
  if (remaining.length === 0) {
    await roomRepo.closeRoom(roomId);
    return { roomClosed: true, hostChanged: false, newHostSessionId: null };
  }

  if (wasHost) {
    const next = remaining.find((p) => p.isOnline) ?? remaining[0];
    if (next) {
      await roomRepo.transferHost(roomId, next.sessionId);
      return { roomClosed: false, hostChanged: true, newHostSessionId: next.sessionId };
    }
  }
  return { roomClosed: false, hostChanged: false, newHostSessionId: null };
}

/** Presence: mark a participant online/offline (socket connect/disconnect). */
export async function markOnline(roomId: string, sessionId: string): Promise<Participant | null> {
  const p = await roomRepo.findParticipant(roomId, sessionId);
  if (!p) return null;
  await roomRepo.setOnline(roomId, sessionId, true);
  return { ...p, isOnline: true };
}

export async function markOffline(roomId: string, sessionId: string): Promise<Participant | null> {
  const p = await roomRepo.findParticipant(roomId, sessionId);
  if (!p) return null;
  await roomRepo.setOnline(roomId, sessionId, false);
  return { ...p, isOnline: false };
}
