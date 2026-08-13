import { defineConfig } from 'vitest/config'

/**
 * Workspace root: collects one project per package. `pnpm test:unit` runs unit and
 * integration tests; e2e (Playwright) runs separately via `pnpm test:e2e` because it needs
 * the compose stack to be up.
 */
export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/api'],
    /**
     * REQUIRED at the ROOT config, not inside a project — Vitest only reads this option at
     * the top level. Every integration test shares one `crm_test` database and every one of
     * them TRUNCATEs; run them in parallel and one file wipes tables while another is
     * asserting, so tests fail at random depending on machine speed. Setting this inside a
     * project config does nothing at all.
     */
    fileParallelism: false,
  },
})
