/**
 * Client-side HTTP helper. Talks to the API **same-origin via relative URLs**
 * (no baked base URL — LESSONS L-7.1), and unwraps the `{ success, data }`
 * envelope, throwing `ApiError` on `{ success:false, code, message }`.
 */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    credentials: 'same-origin',
  });
  const body = (await res.json().catch(() => null)) as
    | { success: true; data: T }
    | { success: false; code: string; message: string }
    | null;

  if (body && body.success) return body.data;
  throw new ApiError(
    body && !body.success ? body.code : 'unexpected',
    body && !body.success ? body.message : res.statusText || 'Request failed',
    res.status,
  );
}

export const httpGet = <T>(path: string): Promise<T> => request<T>(path, { method: 'GET' });

export const httpPost = <T>(path: string, data: unknown): Promise<T> =>
  request<T>(path, { method: 'POST', body: JSON.stringify(data ?? {}) });
