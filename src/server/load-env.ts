import { loadEnvConfig } from '@next/env';

/**
 * Side-effect module: populate `process.env` from `.env*` files BEFORE any
 * module that reads configuration is imported.
 *
 * The custom server reads + validates config at import time (`src/lib/config`),
 * which happens before `next()` would load env files. Importing this module
 * first (see `src/server/index.ts`) guarantees env is present for local
 * (non-Docker) runs. In Docker, env is injected by Compose and no `.env` file
 * exists, so this is a harmless no-op.
 */
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production');
