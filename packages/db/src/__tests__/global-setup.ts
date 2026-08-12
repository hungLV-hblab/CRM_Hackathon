import { resolve } from 'node:path'

import { config } from 'dotenv'
import { Pool } from 'pg'

import { runMigrations } from '../migrate'

/**
 * Builds the schema on the test database before any `packages/db` test runs.
 *
 * The column-privilege tests MUST run against a real Postgres: the whole second defence
 * layer lives in `GRANT` statements and no fake reproduces it. So when the connection fails
 * the error has to be READABLE right here, rather than letting eight tests go red with a
 * confusing message.
 */
export async function setup(): Promise<void> {
  config({ path: resolve(__dirname, '../../../../.env') })

  const url = process.env.DATABASE_URL_TEST
  if (!url) {
    throw new Error('Missing DATABASE_URL_TEST. Copy .env.example to .env (see README).')
  }

  const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 5_000 })
  try {
    await pool.query('SELECT 1')
  } catch (error) {
    throw new Error(
      [
        'Cannot reach the test database at DATABASE_URL_TEST.',
        'Postgres must be running: `pnpm dev` (or `docker compose -f infra/docker-compose.yml --env-file .env up -d postgres`).',
        'If an old volume predates the three roles: `docker compose -f infra/docker-compose.yml down -v`, then bring it up again.',
        `Underlying error: ${(error as Error).message}`,
      ].join('\n'),
    )
  } finally {
    await pool.end()
  }

  await runMigrations(url)
}
