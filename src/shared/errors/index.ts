import { ZodError } from 'zod';

/**
 * Error catalog — one source for HTTP and Socket.IO acks (REALTIME §4.2,
 * unified to the `{ success, code, message }` envelope per Phase 2 D2).
 */
export type ErrorType =
  | 'validation'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'unexpected';

export interface ErrorCode {
  readonly code: string;
  readonly type: ErrorType;
  readonly httpStatus: number;
}

const def = (code: string, type: ErrorType, httpStatus: number): ErrorCode => ({
  code,
  type,
  httpStatus,
});

export const ERRORS = {
  VALIDATION_FAILED: def('validation.failed', 'validation', 400),
  SESSION_REQUIRED: def('session.required', 'unauthorized', 401),
  ROOM_NOT_FOUND: def('room.not_found', 'not_found', 404),
  ROOM_CLOSED: def('room.closed', 'conflict', 409),
  ROOM_FULL: def('room.full', 'conflict', 409),
  ROOM_CODE_GENERATION_FAILED: def('room.code_generation_failed', 'unexpected', 500),
  PARTICIPANT_NOT_FOUND: def('participant.not_found', 'not_found', 404),
  PLAYBACK_FORBIDDEN: def('playback.forbidden', 'forbidden', 403),
  PLAYBACK_INVALID_POSITION: def('playback.invalid_position', 'validation', 400),
  PLAYBACK_CONFLICT: def('playback.conflict', 'conflict', 409),
  QUEUE_FORBIDDEN: def('queue.forbidden', 'forbidden', 403),
  QUEUE_INVALID_PROVIDER: def('queue.invalid_provider', 'validation', 400),
  QUEUE_ITEM_NOT_FOUND: def('queue.item_not_found', 'not_found', 404),
  QUEUE_CANNOT_REMOVE_CURRENT: def('queue.cannot_remove_current', 'conflict', 409),
  QUEUE_INVALID_REORDER: def('queue.invalid_reorder', 'validation', 400),
  // ── in-app search protection layer (docs/features/youtube-in-app-search) ──
  /** Same video already current/upcoming. Warn-not-block: client confirms then
   *  re-sends with allowDuplicate=true. */
  QUEUE_DUPLICATE: def('queue.duplicate', 'conflict', 409),
  /** Add rate limit hit (per room+session). Ack carries retryAfterMs. */
  QUEUE_RATE_LIMITED: def('queue.rate_limited', 'rate_limited', 429),
  /** Video can't be embedded / is unavailable (deleted, private, embed-disabled). */
  QUEUE_UNPLAYABLE: def('queue.unplayable', 'validation', 422),
  /** Video is a livestream/premiere — no finite duration; would stall the engine. */
  QUEUE_LIVESTREAM: def('queue.livestream', 'validation', 422),
  /** Per-user pending-items cap reached (anti-domination). */
  QUEUE_USER_LIMIT: def('queue.user_limit', 'conflict', 409),
  /** Per-room queue ceiling reached (backstop). */
  QUEUE_FULL: def('queue.full', 'conflict', 409),
  /** Generic too-many-requests (e.g. search). Ack carries retryAfterMs. */
  RATE_LIMITED: def('rate_limited', 'rate_limited', 429),
  CHAT_EMPTY: def('chat.empty_message', 'validation', 400),
  CHAT_TOO_LONG: def('chat.message_too_long', 'validation', 400),
  UNEXPECTED: def('unexpected', 'unexpected', 500),
} as const;

/** Thrown by domain/services; mapped to the envelope + HTTP status at the edge. */
export class AppError extends Error {
  readonly errorCode: ErrorCode;
  /** Hint for retry-able errors (e.g. rate limits) — surfaced on the wire envelope. */
  readonly retryAfterMs?: number;

  constructor(errorCode: ErrorCode, message?: string, retryAfterMs?: number) {
    super(message ?? errorCode.code);
    this.name = 'AppError';
    this.errorCode = errorCode;
    this.retryAfterMs = retryAfterMs;
  }

  get code(): string {
    return this.errorCode.code;
  }
  get httpStatus(): number {
    return this.errorCode.httpStatus;
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

/** Normalize any thrown error → { code, message, httpStatus, retryAfterMs? } for the envelope. */
export function describeError(err: unknown): {
  code: string;
  message: string;
  httpStatus: number;
  retryAfterMs?: number;
} {
  if (err instanceof ZodError) {
    const message = err.issues.map((i) => i.message).join('; ') || 'Validation failed';
    return { code: ERRORS.VALIDATION_FAILED.code, message, httpStatus: 400 };
  }
  if (isAppError(err)) {
    return {
      code: err.code,
      message: err.message,
      httpStatus: err.httpStatus,
      ...(err.retryAfterMs !== undefined ? { retryAfterMs: err.retryAfterMs } : {}),
    };
  }
  return { code: ERRORS.UNEXPECTED.code, message: 'Something went wrong', httpStatus: 500 };
}
