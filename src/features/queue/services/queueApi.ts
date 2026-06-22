import { httpGet } from '@/lib/http';
import type { QueueItemDto } from '@/shared/types';

export const getQueue = (roomId: string) =>
  httpGet<{ queue: QueueItemDto[] }>(`/api/rooms/${roomId}/queue`);
