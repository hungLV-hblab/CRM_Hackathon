import { resolve } from 'node:path'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'db',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    /** Builds the schema on the test database once, before any test runs. */
    globalSetup: ['src/__tests__/global-setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: {
      '@crm/contracts': resolve(__dirname, '../contracts/src'),
    },
  },
})
