import type { Pool } from 'pg'

import { ALL_TABLE_NAMES } from '../schema/all-tables'

/**
 * Empties every table on the TEST database. Integration tests share one `crm_test` database
 * (that is why `fileParallelism` is off at the vitest root), so each file starts by clearing
 * it rather than assuming what the previous file left behind.
 *
 * Takes the `crm_owner` pool: it is the only role allowed to delete. `crm_app` never needs to
 * and `crm_system` is forbidden outright (ontology section 5).
 *
 * The table list lives in `schema/all-tables.ts`, shared with `seed()`. Retyping it per test
 * file is how a new table gets forgotten in three places out of four.
 */
export async function resetTestDatabase(owner: Pool): Promise<void> {
  const tables = ALL_TABLE_NAMES.map((name) => `"${name}"`).join(', ')
  await owner.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`)
}
