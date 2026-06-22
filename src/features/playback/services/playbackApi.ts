import { httpGet } from '@/lib/http';
import type { PlaybackSnapshotDto } from '@/shared/types';

export const getPlayback = (roomId: string) =>
  httpGet<PlaybackSnapshotDto>(`/api/rooms/${roomId}/playback`);
