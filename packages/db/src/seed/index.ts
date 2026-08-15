import { resolve } from 'node:path'

import { config } from 'dotenv'
import { getTableName, sql } from 'drizzle-orm'

import { createConnection } from '../client'
import {
  ALL_TABLES,
  SETTING_KEY_AI_ENABLED,
  SETTING_KEY_WATCH_CYCLE_SECONDS,
  companies,
  contacts,
  opportunities,
  snapshotPages,
  systemSettings,
  users,
} from '../schema'
import { loadDefaultDataset } from './default-dataset'
import { SEED_USERS } from './default-users'
import type { SeedDataset } from './seed-dataset'

export * from './default-users'
export * from './seed-dataset'
export * from './parse-zip-dataset'
export * from './default-dataset'
export * from './deterministic-uuid'

/**
 * I-14 and spec 7 condition 5 — judges replay the scenario a second time, so both `pnpm seed`
 * and the admin upload endpoint have to return the system to EXACTLY the initial state, not
 * approximately.
 *
 * Hence TRUNCATE then INSERT, rather than `ON CONFLICT DO NOTHING`: the latter keeps
 * everything the demo produced (the company a judge just created, watch-cycle logs, audit
 * trail) and the second run would start from a different state than the first.
 *
 * `dataset` is REQUIRED, not optional-with-a-default: a seed function that silently reads a
 * file when nobody passed one is a hidden side effect. `loadDefaultDataset()` is the explicit
 * way to get the checked-in dataset — see `runFromCli()` below and every test caller.
 *
 * Runs as `crm_owner` — the only role allowed to delete. `crm_app` has no need to,
 * `crm_system` is forbidden outright (ontology section 5: never delete human-created data).
 */
export async function seed(connectionString: string, dataset: SeedDataset): Promise<void> {
  const { db, close } = createConnection(connectionString)
  try {
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`TRUNCATE TABLE ${sql.join(
          ALL_TABLES.map((table) => sql.identifier(getTableName(table))),
          sql`, `,
        )} RESTART IDENTITY CASCADE`,
      )

      await tx.insert(users).values(SEED_USERS)
      if (dataset.companies.length > 0) await tx.insert(companies).values(dataset.companies)
      if (dataset.contacts.length > 0) await tx.insert(contacts).values(dataset.contacts)
      if (dataset.opportunities.length > 0) {
        // Board positions assigned here, not left to the column default: one INSERT gives every
        // row the same `updated_at`, so the tiebreak would order tied rows arbitrarily and the
        // board would deal a different column order on every reseed.
        await tx.insert(opportunities).values(withBoardOrder(dataset.opportunities))
      }
      if (dataset.snapshotPages.length > 0) {
        await tx.insert(snapshotPages).values(dataset.snapshotPages)
      }

      /**
       * ontology 3.4: env holds the INITIAL value and is read here, and only here. After
       * this line env means nothing — changing the cycle length means UPDATE-ing
       * `system_settings`, not editing `.env`.
       */
      await tx.insert(systemSettings).values([
        { key: SETTING_KEY_AI_ENABLED, value: process.env.AI_ENABLED ?? 'true' },
        { key: SETTING_KEY_WATCH_CYCLE_SECONDS, value: process.env.WATCH_CYCLE_SECONDS ?? '60' },
      ])
    })
  } finally {
    await close()
  }
}

/** Position within each stage column, in the order the imported dataset lists the deals. */
function withBoardOrder<T extends { stage: string }>(rows: T[]): (T & { boardOrder: number })[] {
  const counters = new Map<string, number>()
  return rows.map((row) => {
    const position = counters.get(row.stage) ?? 0
    counters.set(row.stage, position + 1)
    return { ...row, boardOrder: position }
  })
}

async function runFromCli(): Promise<void> {
  config({ path: resolve(__dirname, '../../../../.env') })
  const url = process.env.DATABASE_URL_OWNER
  if (!url) {
    throw new Error('Missing DATABASE_URL_OWNER. Copy .env.example to .env and fill it in.')
  }
  const dataset = loadDefaultDataset()
  await seed(url, dataset)
  if (dataset.warnings.length > 0) {
    console.warn(`Cảnh báo lúc parse dữ liệu:\n${dataset.warnings.map((w) => `  - ${w}`).join('\n')}`)
  }
  console.log(
    `Seed complete: ${SEED_USERS.length} users, ${dataset.companies.length} companies, ` +
      `${dataset.contacts.length} contacts, ${dataset.opportunities.length} opportunities, ` +
      `${dataset.snapshotPages.length} snapshot pages.`,
  )
}

if (require.main === module) {
  runFromCli().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
