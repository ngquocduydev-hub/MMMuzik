import type { AppSocket } from '../io';
import { ok, fail } from '@/shared/http/response';
import { describeError } from '@/shared/errors';
import {
  addTrack,
  removeTrack,
  reorderQueue,
  clearQueue,
  skip,
  reportDuration,
  advanceOnEnded,
  recoverFromError,
} from '@/server/services/queueService';

/**
 * Queue + auto-next commands. The service does all DB work AND broadcasts (via
 * the Redis emitter), so handlers just invoke and ack. Authority (host-only for
 * remove/reorder/clear; any participant for add/skip) is enforced in the service.
 */
export function registerQueueHandlers(socket: AppSocket): void {
  const sid = () => socket.data.sessionId;
  const errAck = (ack: (r: ReturnType<typeof fail>) => void, err: unknown) => {
    const { code, message, retryAfterMs } = describeError(err);
    ack(fail(code, message, retryAfterMs));
  };

  socket.on('queue:add', async ({ roomId, urlOrId, allowDuplicate }, ack) => {
    try {
      ack(ok(await addTrack(roomId, sid(), urlOrId, allowDuplicate ?? false)));
    } catch (err) {
      errAck(ack, err);
    }
  });

  socket.on('queue:remove', async ({ roomId, queueItemId }, ack) => {
    try {
      await removeTrack(roomId, sid(), queueItemId);
      ack(ok({ ok: true }));
    } catch (err) {
      errAck(ack, err);
    }
  });

  socket.on('queue:reorder', async ({ roomId, orderedIds }, ack) => {
    try {
      await reorderQueue(roomId, sid(), orderedIds);
      ack(ok({ ok: true }));
    } catch (err) {
      errAck(ack, err);
    }
  });

  socket.on('queue:clear', async ({ roomId }, ack) => {
    try {
      await clearQueue(roomId, sid());
      ack(ok({ ok: true }));
    } catch (err) {
      errAck(ack, err);
    }
  });

  // Ephemeral "I'm adding/searching" cue → re-broadcast to OTHERS in the room.
  // Identity is the handshake-bound session, never a payload. Fire-and-forget;
  // nothing is persisted (Phase 5 social cue).
  socket.on('queue:activity', ({ roomId }) => {
    const sessionId = sid();
    if (!sessionId) return;
    socket.to(`room:${roomId}`).emit('presence:adding', { roomId, sessionId });
  });

  socket.on('playback:skip', async ({ roomId }, ack) => {
    try {
      await skip(roomId, sid());
      ack(ok({ ok: true }));
    } catch (err) {
      errAck(ack, err);
    }
  });

  // Host player accelerator: the current video ended → advance (idempotent).
  socket.on('playback:trackEnded', async ({ roomId, endedItemId }, ack) => {
    try {
      await advanceOnEnded(roomId, sid(), endedItemId);
      ack(ok({ ok: true }));
    } catch (err) {
      errAck(ack, err);
    }
  });

  // Play-time recovery: host's current track is unplayable → auto-skip (host-only,
  // idempotent). Guests never emit this — their error is handled locally.
  socket.on('playback:trackError', async ({ roomId, itemId }, ack) => {
    try {
      await recoverFromError(roomId, sid(), itemId);
      ack(ok({ ok: true }));
    } catch (err) {
      errAck(ack, err);
    }
  });

  socket.on('playback:reportDuration', async ({ roomId, queueItemId, durationMs }, ack) => {
    try {
      await reportDuration(roomId, sid(), queueItemId, durationMs);
      ack(ok({ ok: true }));
    } catch (err) {
      errAck(ack, err);
    }
  });
}
