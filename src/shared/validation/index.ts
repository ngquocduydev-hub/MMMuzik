import { z } from 'zod';
import { SEARCH_QUERY_MAX_LEN } from '@/shared/constants';

/**
 * Request validation (zod). Returns structured errors at the edge; the parsed
 * output types feed the services.
 */
export const nicknameSchema = z.string().trim().min(1, 'Nickname is required').max(40);
export const avatarSchema = z.string().trim().max(512).optional();
export const roomNameSchema = z.string().trim().min(1, 'Room name is required').max(80);

/** Accepts any case + 6–8 alphanumerics; normalizes to uppercase. */
export const roomCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9]{6,8}$/, 'Invalid room code')
  .transform((s) => s.toUpperCase());

export const roomIdSchema = z.string().uuid('Invalid room id');

/** Public → discoverable + open-join; private → hidden, join by code only. */
export const roomVisibilitySchema = z.enum(['public', 'private']);

export const createRoomSchema = z.object({
  name: roomNameSchema,
  nickname: nicknameSchema,
  avatar: avatarSchema,
  visibility: roomVisibilitySchema.default('public'),
});

export const joinRoomSchema = z.object({
  code: roomCodeSchema,
  nickname: nicknameSchema.optional(),
  avatar: avatarSchema,
});

export const seekSchema = z.object({
  positionMs: z.number().int().nonnegative('positionMs must be >= 0'),
});

/**
 * Chat send payload shape-check at the boundary. The hard string cap (2× the
 * domain max) is a cheap abuse guard; the precise empty / too-long rules — which
 * map to the `chat.empty_message` / `chat.message_too_long` catalog codes — run
 * in the domain/service so the client gets the exact, actionable error.
 */
export const chatSendSchema = z.object({
  roomId: roomIdSchema,
  body: z.string().max(4000, 'Message is too long'),
});

/** History page size: ?take= (default 50, clamped to 1..100 — REQ-CHAT-3). */
export const chatHistoryQuerySchema = z.object({
  take: z.coerce.number().int().min(1).max(100).default(50),
});

/** Search query: ?q= — trimmed, non-empty, capped (Phase 2). */
export const searchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Enter something to search for').max(SEARCH_QUERY_MAX_LEN),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
export type SeekInput = z.infer<typeof seekSchema>;
export type ChatSendInput = z.infer<typeof chatSendSchema>;
