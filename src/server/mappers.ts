import type { Room, Participant, Session, QueueItem, Track, ChatMessage } from '@prisma/client';
import type {
  RoomDto,
  ParticipantDto,
  SessionDto,
  QueueItemDto,
  PlaybackStateDto,
  ChatMessageDto,
} from '@/shared/types';
import type { PlaybackAnchor } from '@/shared/domain/playback';

/** Prisma models → wire DTOs. */
export const toRoomDto = (r: Room): RoomDto => ({
  id: r.id,
  code: r.code,
  name: r.name,
  status: r.status,
  hostSessionId: r.hostSessionId,
  createdAt: r.createdAt.toISOString(),
});

export const toParticipantDto = (p: Participant): ParticipantDto => ({
  sessionId: p.sessionId,
  nickname: p.nickname,
  avatar: p.avatar,
  role: p.role,
  isOnline: p.isOnline,
  joinedAt: p.joinedAt.toISOString(),
});

export const toSessionDto = (s: Session): SessionDto => ({
  id: s.id,
  displayName: s.displayName,
  avatar: s.avatar,
});

export const toQueueItemDto = (qi: QueueItem & { track: Track }): QueueItemDto => ({
  id: qi.id,
  roomId: qi.roomId,
  trackId: qi.trackId,
  provider: qi.track.provider,
  videoId: qi.track.providerTrackId,
  title: qi.track.title,
  durationMs: Number(qi.track.durationMs),
  thumbnailUrl: qi.track.thumbnailUrl,
  position: qi.position,
  addedBySessionId: qi.addedBySessionId,
  addedByNickname: qi.addedByNickname,
  addedAt: qi.addedAt.toISOString(),
});

export const toChatMessageDto = (m: ChatMessage): ChatMessageDto => ({
  id: m.id,
  roomId: m.roomId,
  sessionId: m.sessionId,
  nickname: m.nickname,
  body: m.body,
  sentAt: m.sentAt.toISOString(),
});

export const toPlaybackStateDto = (roomId: string, a: PlaybackAnchor): PlaybackStateDto => ({
  roomId,
  status: a.status,
  currentTrackId: a.currentTrackId,
  currentVideoId: a.currentVideoId,
  positionMs: a.positionMs,
  updatedAtUtc: a.updatedAtUtc,
  revision: a.revision,
});
