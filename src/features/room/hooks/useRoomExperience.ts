'use client';

import { useEffect } from 'react';
import { getSocket } from '@/lib/socket-client';
import { ApiError } from '@/lib/http';
import { useConnectionStore } from '@/stores/connectionStore';
import { useRoomStore } from '@/features/room/store';
import { useParticipantsStore } from '@/features/participants/store';
import { usePlaybackStore } from '@/features/playback/store';
import { useQueueStore } from '@/features/queue/store';
import { useChatStore } from '@/features/chat/store';
import { subscribeRealtime } from '@/features/room/services/realtimeService';
import { getRoom, getParticipants, getSession } from '@/features/room/services/roomApi';
import { getPlayback } from '@/features/playback/services/playbackApi';
import { getQueue } from '@/features/queue/services/queueApi';
import { getMessages } from '@/features/chat/services/chatApi';
import { measureClockOffset } from '@/features/playback/services/clockSync';

/** Fetch all snapshots and hydrate the stores (join-in-progress + reconnect). */
async function refreshSnapshots(roomId: string): Promise<void> {
  const [{ room }, { participants }, snapshot, { session }, { queue }, { messages }] =
    await Promise.all([
      getRoom(roomId),
      getParticipants(roomId),
      getPlayback(roomId),
      getSession(),
      getQueue(roomId),
      getMessages(roomId),
    ]);
  useRoomStore.getState().setRoom(room);
  if (session) useRoomStore.getState().setSession(session);
  useParticipantsStore.getState().hydrate(participants);
  usePlaybackStore.getState().reconcile(snapshot.playback);
  useQueueStore.getState().hydrate(queue);
  useChatStore.getState().hydrate(messages);
}

/**
 * Orchestrates the realtime room experience for a roomId:
 *   connect → subscribe (before fetch) → join → fetch snapshots → clock sync.
 * `connect` fires again on every reconnect, so the same flow re-runs and there
 * is no stale state. All state lives in stores; this hook only wires effects.
 */
export function useRoomExperience(roomId: string): void {
  useEffect(() => {
    const socket = getSocket();
    useConnectionStore.getState().setStatus('connecting');
    const dispose = subscribeRealtime(socket); // subscribe BEFORE connecting

    const syncClock = async () => {
      const best = await measureClockOffset(socket);
      if (best) usePlaybackStore.getState().setClock(best.offsetMs, best.rttMs);
    };

    const onConnect = () => {
      useConnectionStore.getState().setStatus('connected');
      socket.emit('room:join', { roomId }, async () => {
        try {
          await refreshSnapshots(roomId);
          await syncClock();
          useRoomStore.getState().setReady(true);
        } catch (err) {
          if (
            err instanceof ApiError &&
            (err.code === 'room.not_found' || err.code === 'room.closed')
          ) {
            useRoomStore.getState().setClosed(true);
          } else {
            useRoomStore.getState().setError('Could not load the room.');
          }
        }
      });
    };
    const onDisconnect = () => useConnectionStore.getState().setStatus('disconnected');
    const onReconnectAttempt = () => useConnectionStore.getState().setStatus('reconnecting');

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect_attempt', onReconnectAttempt);
    socket.connect();

    const clockTimer = setInterval(() => {
      if (socket.connected) void syncClock();
    }, 10_000);

    return () => {
      clearInterval(clockTimer);
      dispose();
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      socket.disconnect();
      useRoomStore.getState().reset();
      useParticipantsStore.getState().reset();
      usePlaybackStore.getState().reset();
      useQueueStore.getState().reset();
      useChatStore.getState().reset();
      useConnectionStore.getState().setStatus('idle');
    };
  }, [roomId]);
}
