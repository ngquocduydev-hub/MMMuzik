import path from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Map the `@/` path alias (mirrors tsconfig paths) without an ESM-only plugin.
    alias: [{ find: /^@\/(.*)$/, replacement: `${path.resolve(process.cwd(), 'src')}/$1` }],
  },
  test: {
    globals: true,
    include: ['tests/**/*.test.{ts,tsx}'],
    // UI tests run in jsdom; everything else in node.
    environmentMatchGlobs: [['tests/ui/**', 'jsdom']],
    environment: 'node',
    setupFiles: ['./tests/ui/setup.ts'],
    // Integration tests share one DB; run files sequentially to avoid cross-talk.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
