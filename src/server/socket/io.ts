import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from '@/shared/events';
import { getRedis } from '@/lib/redis';
import { config } from '@/lib/config';
import { logger } from '@/lib/logger';
import { registerRoomNamespace } from './namespace';

/** Strongly-typed Socket.IO server/socket for the app contract. */
export type AppServer = SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
export type AppSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

/**
 * Create and configure the Socket.IO server attached to the custom HTTP server.
 * The Redis adapter is wired from day one (ARCHITECTURE AD-3) so broadcasts fan
 * out across instances under horizontal scale.
 */
export function createSocketServer(httpServer: HttpServer): AppServer {
  const io: AppServer = new SocketIOServer(httpServer, {
    cors: { origin: config.APP_URL, credentials: true },
    transports: ['websocket', 'polling'],
  });

  const pubClient = getRedis().duplicate();
  const subClient = getRedis().duplicate();
  io.adapter(createAdapter(pubClient, subClient));

  registerRoomNamespace(io);

  logger.info('Socket.IO initialized with Redis adapter');
  return io;
}
