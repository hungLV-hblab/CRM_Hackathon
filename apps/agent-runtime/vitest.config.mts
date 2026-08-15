import { resolve } from 'node:path'

import { defineConfig } from 'vitest/config'

/**
 * No database, no global setup: nothing in this package touches Postgres, which is the whole
 * point of it existing as a separate process. Tests here must stay runnable with the compose
 * stack down.
 */
export default defineConfig({
  test: {
    name: 'agent-runtime',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@crm/contracts': resolve(__dirname, '../../packages/contracts/src'),
    },
  },
})
