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
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

export const ok = <T>(data: T): SuccessResponse<T> => ({ success: true, data });

export const fail = (code: string, message: string): ErrorResponse => ({
  success: false,
  code,
  message,
});
