import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@/shared/events';

/**
 * Socket.IO client singleton. Connects **same-origin** (no baked URL); the
 * session cookie rides the handshake via `withCredentials`. Auto-reconnect with
 * capped backoff (REALTIME §13). `autoConnect:false` — the room hook connects.
 */
export type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: ClientSocket | null = null;

export function getSocket(): ClientSocket {
  if (!socket) {
    socket = io({
      path: '/socket.io',
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 10_000,
      randomizationFactor: 0.5,
    });
  }
  return socket;
}
