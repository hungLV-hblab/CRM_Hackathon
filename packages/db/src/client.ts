import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import * as schema from './schema'

export type CrmDatabase = NodePgDatabase<typeof schema>

export interface CrmConnection {
  db: CrmDatabase
  pool: Pool
  close(): Promise<void>
}

/**
 * ADR-0010 — the two pools are two IDENTITIES at the database level, not two copies for
 * throughput. Picking the wrong one silently removes the second layer of defence:
 *
 *   `crm_app`    → every write initiated by a HUMAN (Sales/Admin through the UI)
 *   `crm_system` → every write by the AI (worker and the AI branches inside the API)
 *
 * `crm_owner` is deliberately absent here: a table owner bypasses column privileges even
 * when NOSUPERUSER (ADR-0010, measurement 3). That role belongs to `migrate.ts` and `seed/`.
 */
export function createConnection(connectionString: string): CrmConnection {
  const pool = new Pool({ connectionString })
  return {
    pool,
    db: drizzle(pool, { schema }),
    close: () => pool.end(),
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing environment variable ${name}. Copy .env.example to .env — see README.`)
  }
  return value
}

/** HUMAN identity. Used by every service touching Sales' official data. */
export function createAppConnection(): CrmConnection {
  return createConnection(requireEnv('DATABASE_URL_APP'))
}

/** AI identity. Privileges narrowed to exactly what `migrations/0001_grants.sql` allows. */
export function createSystemConnection(): CrmConnection {
  return createConnection(requireEnv('DATABASE_URL_SYSTEM'))
}
