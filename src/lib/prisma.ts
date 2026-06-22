import { PrismaClient } from '@prisma/client';
import { isProduction } from './config';

/**
 * Prisma client singleton.
 *
 * A single long-lived client per process (ARCHITECTURE.md §8.2 / AD-11) avoids
 * connection storms. In development, cache it on `globalThis` so hot-reload
 * (tsx watch) does not create a new client on every reload.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction ? ['error', 'warn'] : ['error', 'warn'],
  });

if (!isProduction) {
  globalForPrisma.prisma = prisma;
}
