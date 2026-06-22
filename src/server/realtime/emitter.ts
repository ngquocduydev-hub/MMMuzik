import { Emitter } from '@socket.io/redis-emitter';
import { getRedis } from '@/lib/redis';
import type { ServerToClientEvents } from '@/shared/events';

/**
 * Redis emitter — lets code OUTSIDE the Socket.IO process (Next REST route
 * handlers, which run in a separate module graph) broadcast to socket rooms by
 * publishing through the same Redis the adapter uses (ARCHITECTURE.md §4 / AD-4).
 *
 * LAZY: the emitter (and its Redis client) is created on first use at RUNTIME,
 * never at import — so importing this file during `next build` is side-effect-free.
 */
let emitter: Emitter<ServerToClientEvents> | null = null;

function getEmitter(): Emitter<ServerToClientEvents> {
  if (!emitter) emitter = new Emitter<ServerToClientEvents>(getRedis());
  return emitter;
}

export const roomChannel = (roomId: string): string => `room:${roomId}`;

export function emitToRoom<E extends keyof ServerToClientEvents>(
  roomId: string,
  event: E,
  ...args: Parameters<ServerToClientEvents[E]>
): void {
  getEmitter()
    .to(roomChannel(roomId))
    .emit(event, ...args);
}
