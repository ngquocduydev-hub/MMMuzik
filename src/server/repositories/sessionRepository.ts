import type { Session } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/** All Session DB access lives here (ARCHITECTURE §8.2 — no Prisma in services). */
export function findSessionById(id: string): Promise<Session | null> {
  return prisma.session.findUnique({ where: { id } });
}

export function createSession(data: {
  displayName: string;
  avatar: string | null;
  expiresAt: Date;
}): Promise<Session> {
  return prisma.session.create({ data });
}

export async function touchSession(id: string, expiresAt: Date): Promise<void> {
  await prisma.session.update({
    where: { id },
    data: { lastSeenAt: new Date(), expiresAt },
  });
}
