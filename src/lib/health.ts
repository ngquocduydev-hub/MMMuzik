import { prisma } from './prisma';
import { checkRedis } from './redis';
import { logger } from './logger';

export interface HealthChecks {
  database: boolean;
  redis: boolean;
}

export interface HealthResult {
  healthy: boolean;
  checks: HealthChecks;
}

/** Verifies PostgreSQL connectivity with a trivial query (no tables required). */
async function checkDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (err) {
    logger.warn({ err }, 'database health check failed');
    return false;
  }
}

/** Aggregate health: verifies database + Redis connectivity. */
export async function getHealth(): Promise<HealthResult> {
  const [database, redis] = await Promise.all([checkDatabase(), checkRedis()]);
  return { healthy: database && redis, checks: { database, redis } };
}
