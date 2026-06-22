import type { AppSocket } from '../io';
import { buildPong } from '@/server/services/clockSyncService';

/** system:ping → system:pong (echoes t0 so the client can compute RTT + offset). */
export function registerClockHandlers(socket: AppSocket): void {
  socket.on('system:ping', ({ t0 }) => {
    socket.emit('system:pong', buildPong(t0));
  });
}
