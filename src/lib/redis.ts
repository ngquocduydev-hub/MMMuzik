import Redis from 'ioredis';
import { getRedisUrl } from './config';
import { logger } from './logger';

/**
 * Redis client — LAZY singleton. The client is constructed (and connects) only
 * on first `getRedis()` call, which happens at RUNTIME (request/server start),
 * never at module import. So `next build` can import this file without
 * connecting to Redis or requiring REDIS_URL (ARCHITECTURE rule).
 */
const globalForRedis = globalThis as unknown as { redis?: Redis };

function createClient(): Redis {
  const client = new Redis(getRedisUrl(), {
    // `null` is required for the Socket.IO Redis adapter (blocking subscribe).
    maxRetriesPerRequest: null,
  });
  client.on('error', (err) => logger.error({ err }, 'redis error'));
  client.on('connect', () => logger.info('redis connected'));
  return client;
}

export function getRedis(): Redis {
  if (!globalForRedis.redis) globalForRedis.redis = createClient();
  return globalForRedis.redis;
}

/** Liveness check used by the health endpoint. */
export async function checkRedis(): Promise<boolean> {
  try {
    const pong = await getRedis().ping();
    return pong === 'PONG';
  } catch (err) {
    logger.warn({ err }, 'redis health check failed');
    return false;
  }
}
