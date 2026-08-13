import { resolve } from 'node:path'

import { config } from 'dotenv'
import { getTableName, sql } from 'drizzle-orm'

import { createConnection } from '../client'
import {
  ALL_TABLES,
  SETTING_KEY_AI_ENABLED,
  SETTING_KEY_WATCH_CYCLE_SECONDS,
  companies,
  opportunities,
  systemSettings,
  timelineEntries,
  users,
} from '../schema'
import {
  SEED_COMPANIES,
  SEED_OPPORTUNITIES,
  SEED_TIMELINE_ENTRIES,
  SEED_USERS,
} from './seed-data'

export * from './seed-data'

/**
 * I-14 and spec 7.5 — judges replay the scenario a second time, so `pnpm seed` has to return
 * the system to EXACTLY the initial state, not approximately.
 *
 * Hence TRUNCATE then INSERT, rather than `ON CONFLICT DO NOTHING`: the latter keeps
 * everything the demo produced (the company a judge just created, watch-cycle logs, audit
 * trail) and the second run would start from a different state than the first.
 *
 * Runs as `crm_owner` — the only role allowed to delete. `crm_app` has no need to,
 * `crm_system` is forbidden outright (ontology section 5: never delete human-created data).
 */
export async function seed(connectionString: string): Promise<void> {
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
      await tx.insert(companies).values(SEED_COMPANIES)
      await tx.insert(opportunities).values(SEED_OPPORTUNITIES)
      await tx.insert(timelineEntries).values(SEED_TIMELINE_ENTRIES)

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

async function runFromCli(): Promise<void> {
  config({ path: resolve(__dirname, '../../../../.env') })
  const url = process.env.DATABASE_URL_OWNER
  if (!url) {
    throw new Error('Missing DATABASE_URL_OWNER. Copy .env.example to .env and fill it in.')
  }
  await seed(url)
  console.log(
    `Seed complete: ${SEED_USERS.length} users, ${SEED_COMPANIES.length} companies, ` +
      `${SEED_OPPORTUNITIES.length} opportunities, ${SEED_TIMELINE_ENTRIES.length} timeline entries.`,
  )
}

if (require.main === module) {
  runFromCli().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
