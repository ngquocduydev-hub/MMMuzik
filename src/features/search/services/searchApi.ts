import { httpGet } from '@/lib/http';
import type { SearchResponseDto } from '@/shared/types';

/**
 * In-app YouTube search (Phase 3 client → Phase 2 endpoint). Same-origin relative
 * URL; the session cookie rides the request (participant gate is server-side). The
 * key lives only on the server. `available:false` ⇒ degrade to URL-paste.
 */
export const searchTracks = (roomId: string, q: string): Promise<SearchResponseDto> =>
  httpGet<SearchResponseDto>(`/api/rooms/${roomId}/search?q=${encodeURIComponent(q)}`);
