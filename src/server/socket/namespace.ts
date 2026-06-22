import type { AppServer } from './io';
import { authMiddleware } from './auth';
import { registerLifecycle } from './lifecycle';
import { registerRoomHandlers } from './handlers/roomHandlers';
import { registerPlaybackHandlers } from './handlers/playbackHandlers';
import { registerQueueHandlers } from './handlers/queueHandlers';
import { registerChatHandlers } from './handlers/chatHandlers';
import { registerClockHandlers } from './handlers/clockHandlers';
import { logger } from '@/lib/logger';

/**
 * One namespace (default `/`), room-scoped by `room:{roomId}` (REALTIME §2).
 * Registers handshake auth + per-connection handlers: room membership +
 * presence, playback commands, queue + auto-next, chat, and clock sync.
 */
export function registerRoomNamespace(io: AppServer): void {
  io.use(authMiddleware);

  io.on('connection', (socket) => {
    registerLifecycle(socket);
    registerRoomHandlers(socket);
    registerPlaybackHandlers(io, socket);
    registerQueueHandlers(socket);
    registerChatHandlers(socket);
    registerClockHandlers(socket);
  });

  logger.info('room namespace registered (playback + queue + chat + clock + membership)');
}
