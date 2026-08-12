import { resolve } from 'node:path'

import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'

const MIGRATIONS_FOLDER = resolve(__dirname, '../migrations')

/**
 * Migrations run as `crm_owner` — the only role allowed to own the schema (ADR-0010).
 * Whoever creates a table owns it, and an owner bypasses column privileges. Run migrations
 * as `crm_app` by accident and `crm_app` becomes the table owner, at which point the second
 * defence layer disappears without a single error being raised. That is why this function
 * takes the connection string explicitly instead of guessing one.
 */
export async function runMigrations(connectionString: string): Promise<void> {
  const pool = new Pool({ connectionString })
  try {
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER })
  } finally {
    await pool.end()
  }
}

async function runFromCli(): Promise<void> {
  config({ path: resolve(__dirname, '../../../.env') })
  const url = process.env.DATABASE_URL_OWNER
  if (!url) {
    throw new Error('Missing DATABASE_URL_OWNER. Copy .env.example to .env and fill it in.')
  }
  await runMigrations(url)
  console.log('Migrations applied.')
}

if (require.main === module) {
  runFromCli().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
