/**
 * Standard response envelope (shared by HTTP responses and Socket.IO acks).
 *   success: { success: true, data }
 *   error:   { success: false, code, message }
 */
export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export interface ErrorResponse {
  success: false;
  code: string;
  message: string;
  /** Retry hint for rate-limited / transient errors (ms). Omitted otherwise. */
  retryAfterMs?: number;
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

export const ok = <T>(data: T): SuccessResponse<T> => ({ success: true, data });

export const fail = (code: string, message: string, retryAfterMs?: number): ErrorResponse => ({
  success: false,
  code,
  message,
  ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
});
