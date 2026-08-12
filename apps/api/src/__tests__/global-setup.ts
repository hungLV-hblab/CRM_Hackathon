import { resolve } from 'node:path'

import { config } from 'dotenv'

import { runMigrations } from '@crm/db'

/**
 * Builds the schema on the test database before the `apps/api` tests run. Drizzle skips
 * migrations that are already applied, so running it again is harmless — and it means the
 * `api` project can be run on its own without remembering an ordering.
 */
export async function setup(): Promise<void> {
  config({ path: resolve(__dirname, '../../../../.env') })

  const url = process.env.DATABASE_URL_TEST
  if (!url) {
    throw new Error(
      'Missing DATABASE_URL_TEST. Copy .env.example to .env and start Postgres (`pnpm dev`).',
    )
  }
  await runMigrations(url)
}
