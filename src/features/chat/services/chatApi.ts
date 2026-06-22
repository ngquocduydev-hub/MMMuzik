import { httpGet } from '@/lib/http';
import type { ChatMessageDto } from '@/shared/types';
import { CHAT_HISTORY_DEFAULT } from '@/shared/constants';

/** Recent chat history snapshot for join-in-progress (REST; live stream is over Socket.IO). */
export const getMessages = (roomId: string, take: number = CHAT_HISTORY_DEFAULT) =>
  httpGet<{ messages: ChatMessageDto[] }>(`/api/rooms/${roomId}/messages?take=${take}`);
