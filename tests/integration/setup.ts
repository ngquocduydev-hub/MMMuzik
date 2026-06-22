import { expect } from 'vitest';
import type { Session } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getRedis } from '@/lib/redis';
import { createSession } from '@/server/repositories/sessionRepository';
import { AppError, isAppError } from '@/shared/errors';

/** Truncate all tables (FK-safe) between tests. */
export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "participants","queue_items","chat_messages","rooms","sessions","tracks","users" RESTART IDENTITY CASCADE',
  );
}

/** Flush the test Redis DB index (REDIS_URL must point at a dedicated index). */
export async function resetRedis(): Promise<void> {
  await getRedis().flushdb();
}

export async function teardown(): Promise<void> {
  await prisma.$disconnect();
  getRedis().disconnect();
}

export function newSession(displayName = 'Guest'): Promise<Session> {
  return createSession({
    displayName,
    avatar: null,
    expiresAt: new Date(Date.now() + 3_600_000),
  });
}

/** Assert that a promise rejects with a specific AppError code. */
export async function expectAppError(p: Promise<unknown>, expectedCode: string): Promise<void> {
  try {
    await p;
    throw new Error(`expected AppError(${expectedCode}) but nothing was thrown`);
  } catch (err) {
    expect(isAppError(err), `expected AppError, got ${String(err)}`).toBe(true);
    expect((err as AppError).code).toBe(expectedCode);
  }
}
