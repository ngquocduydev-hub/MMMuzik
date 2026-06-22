import type { NextConfig } from 'next';

/**
 * Next.js configuration.
 *
 * NOTE: `output: 'standalone'` is intentionally NOT used. MMMuzik runs behind a
 * custom Node server (`src/server/index.ts`) that co-hosts Socket.IO on the same
 * HTTP server (ARCHITECTURE.md §4 — the permitted single-process variant).
 * The standalone target assumes `next start`, which we do not use.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
