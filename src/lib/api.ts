import { NextResponse } from 'next/server';
import { ok, fail } from '@/shared/http/response';
import { describeError, ERRORS } from '@/shared/errors';
import { logger } from './logger';

/**
 * Next route-handler helpers: wrap results in the standard envelope and map
 * errors → HTTP status (via the shared `describeError`, identical to socket acks).
 */
export function jsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(ok(data), { status });
}

export function jsonError(code: string, message: string, status: number): NextResponse {
  return NextResponse.json(fail(code, message), { status });
}

export function handleRouteError(err: unknown): NextResponse {
  const { code, message, httpStatus } = describeError(err);
  if (httpStatus >= 500) logger.error({ err }, 'unhandled route error');
  return jsonError(code, message, httpStatus);
}

export { ERRORS };
