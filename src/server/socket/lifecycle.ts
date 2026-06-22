import type { AppSocket } from './io';
import { logger } from '@/lib/logger';
import { markOffline } from '@/server/services/roomService';

const ROOM_PREFIX = 'room:';

/**
 * Connection lifecycle + presence-offline. On `disconnecting` (rooms still
 * populated) we mark the participant offline and tell the room. Full removal /
 * reconnect-grace lands in the reconnection phase — disconnect here = offline,
 * not "left".
 */
export function registerLifecycle(socket: AppSocket): void {
  logger.info({ socketId: socket.id, sessionId: socket.data.sessionId }, 'socket connected');

  socket.on('disconnecting', () => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) return;
    for (const room of socket.rooms) {
      if (!room.startsWith(ROOM_PREFIX)) continue;
      const roomId = room.slice(ROOM_PREFIX.length);
      void markOffline(roomId, sessionId);
      socket.to(room).emit('presence:participantOffline', { roomId, sessionId });
    }
  });

  socket.on('disconnect', (reason) => {
    logger.info({ socketId: socket.id, reason }, 'socket disconnected');
  });
}
