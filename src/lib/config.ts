import { z } from 'zod';

/**
 * Runtime configuration.
 *
 * BUILD SAFETY (CLAUDE.md / ARCHITECTURE rules): every field parsed eagerly here
 * has a DEFAULT, so importing this module NEVER throws — `next build` can collect
 * page data without DB/Redis env present. The required connection strings
 * (DATABASE_URL, REDIS_URL) are read LAZILY and validated at RUNTIME only (when a
 * DB/Redis client is actually constructed), so they never block the build.
 */
const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  /** Public origin of the app (single origin for UI + API + realtime). */
  APP_URL: z.string().url().default('http://localhost:3000'),
  /** Port the custom server listens on. */
  PORT: z.coerce.number().int().positive().default(3000),
});

export type AppConfig = z.infer<typeof baseSchema>;

// Never throws: all fields are defaulted.
export const config: AppConfig = baseSchema.parse(process.env);

export const isProduction = config.NODE_ENV === 'production';
export const isDevelopment = config.NODE_ENV === 'development';

/** PostgreSQL URL — read + validated lazily at runtime (Prisma also reads env directly). */
export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required at runtime');
  return url;
}

/** Redis URL — read + validated lazily at runtime (never at import/build). */
export function getRedisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error('REDIS_URL is required at runtime');
  return url;
}

/**
 * Fail-fast validation of required runtime env. Call once at SERVER STARTUP
 * (not at import) so a misconfigured deployment crashes loudly — but the build,
 * which never calls this, stays env-independent.
 */
export function assertRuntimeConfig(): void {
  const missing: string[] = [];
  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
  if (!process.env.REDIS_URL) missing.push('REDIS_URL');
  if (missing.length > 0) {
    throw new Error(`Missing required runtime environment: ${missing.join(', ')}`);
  }
}
