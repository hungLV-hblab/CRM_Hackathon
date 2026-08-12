import { resolve } from 'node:path'

import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

/**
 * NestJS relies on decorators plus `emitDecoratorMetadata`; esbuild (Vite's default) does not
 * emit that metadata, so dependency injection breaks. `unplugin-swc` compiles with SWC, which
 * keeps it. Configured at phase 1 rather than phase 3 — this is the most fragile part of the
 * test setup and it should fail early if it is going to fail.
 *
 * Aliases point straight at each internal package's `src` so tests do not need a build first.
 * Production still resolves `dist` through `main` in package.json.
 */
export default defineConfig({
  test: {
    name: 'api',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['reflect-metadata', './src/__tests__/test-environment-setup.ts'],
    globalSetup: ['./src/__tests__/global-setup.ts'],
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@crm/contracts': resolve(__dirname, '../../packages/contracts/src'),
      '@crm/db': resolve(__dirname, '../../packages/db/src'),
    },
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
})
