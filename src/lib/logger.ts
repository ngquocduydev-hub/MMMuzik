import pino from 'pino';
import { config, isProduction } from './config';

/**
 * Structured logger (CLAUDE.md — Coding Standards: structured logging only,
 * no `console.log` in non-debug paths; never log secrets or session tokens).
 *
 * In development, pretty-print for readability. In production, emit JSON.
 */
export const logger = pino({
  level: isProduction ? 'info' : 'debug',
  base: { service: 'mmmuzik', env: config.NODE_ENV },
  redact: {
    // Never log credentials, cookies, or session tokens.
    paths: ['req.headers.cookie', 'headers.cookie', 'sessionToken', 'password'],
    remove: true,
  },
  // Pretty-print only in real dev; plain JSON in prod and under test (no worker
  // thread, so Vitest exits cleanly).
  transport:
    isProduction || config.NODE_ENV === 'test'
      ? undefined
      : {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
        },
});

export type Logger = typeof logger;
