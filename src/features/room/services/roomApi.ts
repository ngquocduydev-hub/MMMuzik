import { httpGet, httpPost } from '@/lib/http';
import type { RoomDto, ParticipantDto, SessionDto, RoomSummaryDto } from '@/shared/types';

interface RoomMembership {
  room: RoomDto;
  participant: ParticipantDto;
  session: SessionDto;
}

export const createRoom = (input: { name: string; nickname: string; avatar?: string }) =>
  httpPost<RoomMembership>('/api/rooms', input);

export const joinRoom = (input: { code: string; nickname?: string; avatar?: string }) =>
  httpPost<RoomMembership>('/api/rooms/join', input);

export const leaveRoom = (roomId: string) =>
  httpPost<{ left: boolean; roomClosed: boolean; hostChanged: boolean }>('/api/rooms/leave', {
    roomId,
  });

export const getRoom = (roomId: string) =>
  httpGet<{ room: RoomDto; participantCount: number }>(`/api/rooms/${roomId}`);

/** Pre-join summary by code (invite/join screen). */
export const getRoomSummary = (code: string) =>
  httpGet<{ summary: RoomSummaryDto }>(`/api/rooms/code/${encodeURIComponent(code)}`);

export const getParticipants = (roomId: string) =>
  httpGet<{ participants: ParticipantDto[] }>(`/api/rooms/${roomId}/participants`);

export const getSession = () => httpGet<{ session: SessionDto | null }>('/api/session');
