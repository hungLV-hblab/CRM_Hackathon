import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright drives the compose stack, it does NOT start one.
 *
 * There is no `webServer` block on purpose: the only environment the end-to-end suite is
 * allowed to judge is the simulated production stack behind Caddy (`pnpm start`), because
 * that is what spec 7.3 asks for and what the judges will open. Letting Playwright boot a
 * `next dev` here would give a green suite against a stack nobody ships.
 *
 * Run order: `pnpm start` in one terminal, `pnpm test:e2e` in another.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  // One worker: every spec logs into the same seeded database and writes rows into it.
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8080',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
