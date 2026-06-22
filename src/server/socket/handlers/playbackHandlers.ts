import type { AppServer, AppSocket } from '../io';
import { ok, fail } from '@/shared/http/response';
import { describeError } from '@/shared/errors';
import type { PlaybackStateDto } from '@/shared/types';
import { playbackPlay, playbackPause, playbackSeek } from '@/server/services/playbackService';

/**
 * Host playback commands. The server validates authority (inside the service),
 * applies the state transition, then broadcasts the new anchor to the room so
 * every client reconciles. Clients are never authoritative.
 */
export function registerPlaybackHandlers(io: AppServer, socket: AppSocket): void {
  const broadcast = (dto: PlaybackStateDto) =>
    io.to(`room:${dto.roomId}`).emit('playback:stateChanged', dto);

  socket.on('playback:play', async ({ roomId }, ack) => {
    try {
      const dto = await playbackPlay(roomId, socket.data.sessionId);
      broadcast(dto);
      ack(ok(dto));
    } catch (err) {
      const { code, message } = describeError(err);
      ack(fail(code, message));
    }
  });

  socket.on('playback:pause', async ({ roomId }, ack) => {
    try {
      const dto = await playbackPause(roomId, socket.data.sessionId);
      broadcast(dto);
      ack(ok(dto));
    } catch (err) {
      const { code, message } = describeError(err);
      ack(fail(code, message));
    }
  });

  socket.on('playback:seek', async ({ roomId, positionMs }, ack) => {
    try {
      const dto = await playbackSeek(roomId, socket.data.sessionId, positionMs);
      broadcast(dto);
      ack(ok(dto));
    } catch (err) {
      const { code, message } = describeError(err);
      ack(fail(code, message));
    }
  });
}
