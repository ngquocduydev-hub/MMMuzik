import type { ClientSocket } from '@/lib/socket-client';
import type {
  PlaybackStateDto,
  ParticipantDto,
  QueueItemDto,
  ChatMessageDto,
} from '@/shared/types';
import { useParticipantsStore } from '@/features/participants/store';
import { usePlaybackStore } from '@/features/playback/store';
import { useQueueStore } from '@/features/queue/store';
import { useChatStore } from '@/features/chat/store';
import { useRoomStore } from '@/features/room/store';

/**
 * Bind server→client events to the stores. Returns a disposer that removes ONLY
 * these handlers (per-handler off, never a blanket off — LESSONS L-2.2).
 * Updates are state-driven: events mutate stores, UI reacts. The UI never
 * mutates playback state directly.
 */
export function subscribeRealtime(socket: ClientSocket): () => void {
  // Presence / host changes surface as centered SYSTEM CHAT CHIPS, not toasts
  // (UI_V1_REFERENCE §5.14, §8.5). Synthesized client-side from these events.
  const playback = (dto: PlaybackStateDto) => usePlaybackStore.getState().reconcile(dto);
  const joined = (p: { participant: ParticipantDto }) => {
    useParticipantsStore.getState().upsert(p.participant);
    useChatStore.getState().pushSystem(`${p.participant.nickname} joined`);
  };
  const left = (p: { sessionId: string }) => {
    const who = useParticipantsStore
      .getState()
      .participants.find((x) => x.sessionId === p.sessionId);
    useParticipantsStore.getState().remove(p.sessionId);
    if (who) useChatStore.getState().pushSystem(`${who.nickname} left`);
  };
  const online = (p: { sessionId: string }) =>
    useParticipantsStore.getState().setOnline(p.sessionId, true);
  const offline = (p: { sessionId: string }) =>
    useParticipantsStore.getState().setOnline(p.sessionId, false);
  const hostChanged = (p: { newHostSessionId: string }) => {
    const who = useParticipantsStore
      .getState()
      .participants.find((x) => x.sessionId === p.newHostSessionId);
    useParticipantsStore.getState().setHost(p.newHostSessionId);
    useRoomStore.getState().setHost(p.newHostSessionId);
    useChatStore.getState().pushSystem(`${who?.nickname ?? 'A new host'} is now host`);
  };
  const closed = () => useRoomStore.getState().setClosed(true);
  const queueUpdated = (p: { queue: QueueItemDto[] }) => useQueueStore.getState().hydrate(p.queue);
  const chatPosted = (p: { message: ChatMessageDto }) => useChatStore.getState().append(p.message); // dedupe-by-id in the store

  socket.on('playback:stateChanged', playback);
  socket.on('presence:participantJoined', joined);
  socket.on('presence:participantLeft', left);
  socket.on('presence:participantOnline', online);
  socket.on('presence:participantOffline', offline);
  socket.on('presence:hostChanged', hostChanged);
  socket.on('room:closed', closed);
  socket.on('queue:updated', queueUpdated);
  socket.on('chat:messagePosted', chatPosted);

  return () => {
    socket.off('playback:stateChanged', playback);
    socket.off('presence:participantJoined', joined);
    socket.off('presence:participantLeft', left);
    socket.off('presence:participantOnline', online);
    socket.off('presence:participantOffline', offline);
    socket.off('presence:hostChanged', hostChanged);
    socket.off('room:closed', closed);
    socket.off('queue:updated', queueUpdated);
    socket.off('chat:messagePosted', chatPosted);
  };
}
