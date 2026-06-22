import './load-env'; // MUST be first — loads .env* before config is read.
import { createServer } from 'node:http';
import next from 'next';
import { config, isDevelopment, assertRuntimeConfig } from '../lib/config';
import { logger } from '../lib/logger';
import { createSocketServer } from './socket/io';
import { startAdvanceWorker } from './workers/advanceWorker';

/**
 * Custom server entrypoint.
 *
 * Boots Next.js (UI + REST route handlers) and co-hosts Socket.IO on the SAME
 * HTTP server (ARCHITECTURE.md §4 — the permitted single-process variant).
 * A long-lived Node process is required because WebSockets cannot live in
 * request-scoped serverless handlers.
 *
 * Run in dev:  tsx watch src/server/index.ts   (pnpm dev)
 * Run in prod: tsx src/server/index.ts          (pnpm start, NODE_ENV=production)
 */
async function bootstrap(): Promise<void> {
  // Fail-fast at RUNTIME (not build) if required env is missing.
  assertRuntimeConfig();

  const app = next({ dev: isDevelopment });
  const handle = app.getRequestHandler();
  await app.prepare();

  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      logger.error({ port: config.PORT }, `port ${config.PORT} is already in use`);
    } else {
      logger.error({ err }, 'http server error');
    }
    process.exit(1);
  });

  createSocketServer(httpServer);
  const stopAdvanceWorker = startAdvanceWorker();

  httpServer.listen(config.PORT, () => {
    logger.info(
      { port: config.PORT, url: config.APP_URL, env: config.NODE_ENV },
      'MMMuzik V2 server ready',
    );
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'shutting down');
    stopAdvanceWorker();
    httpServer.close(() => process.exit(0));
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error({ err }, 'fatal: server failed to start');
  process.exit(1);
});
