import type { AppSocket } from '../io';
import { ok, fail } from '@/shared/http/response';
import { describeError } from '@/shared/errors';
import { logger } from '@/lib/logger';
import { markOnline } from '@/server/services/roomService';
import { toParticipantDto } from '@/server/mappers';

const groupOf = (roomId: string) => `room:${roomId}`;

/**
 * Room membership + presence. On join the socket enters the `room:{roomId}`
 * group, the participant is marked online, and OTHERS are told they joined.
 */
export function registerRoomHandlers(socket: AppSocket): void {
  socket.on('room:join', async ({ roomId }, ack) => {
    try {
      await socket.join(groupOf(roomId));
      const sessionId = socket.data.sessionId;
      if (sessionId) {
        const participant = await markOnline(roomId, sessionId);
        if (participant) {
          // Tell everyone else in the room (the joiner already has themselves).
          socket.to(groupOf(roomId)).emit('presence:participantJoined', {
            roomId,
            participant: toParticipantDto(participant),
          });
        }
      }
      logger.info({ socketId: socket.id, sessionId, roomId }, 'room:join');
      ack(ok({ joined: true }));
    } catch (err) {
      const { code, message } = describeError(err);
      ack(fail(code, message));
    }
  });

  socket.on('room:leave', async ({ roomId }, ack) => {
    try {
      await socket.leave(groupOf(roomId));
      ack(ok({ left: true }));
    } catch (err) {
      const { code, message } = describeError(err);
      ack(fail(code, message));
    }
  });
}
