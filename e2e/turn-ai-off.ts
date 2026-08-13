import { resolve } from 'node:path'

import { config } from 'dotenv'
import { Pool } from 'pg'

/**
 * The key as it is stored (`packages/db/src/schema/system-settings.ts`). Written out rather
 * than imported: `@crm/db` resolves to its BUILT output, and the e2e suite must not need a
 * package build to run against a stack that is already up.
 */
const SETTING_KEY_AI_ENABLED = 'ai_enabled'

/**
 * Flips the AI kill switch straight in the database, for specs that need the system in a
 * known state before the first click.
 *
 * SQL rather than a click, deliberately: the switch's own SCREEN is acceptance check 9 and
 * feature group 6, which do not exist yet. A T-1 written against that screen could not run
 * until group 6 shipped, and T-1 is the check that has to work first — it is the one that
 * says the CRM stands up without any AI at all.
 *
 * `ai_enabled` is read fresh from the database on every call by both the API and the worker
 * (no cache, see `SystemSettingService`), so an UPDATE here takes effect on the next request.
 *
 * Runs as `crm_owner`: this is a test harness reaching past the application on purpose, not a
 * user action. Every spec that turns the switch off MUST turn it back on in `afterAll`, or the
 * next spec inherits an AI-less system and fails for a reason that has nothing to do with it.
 */
export async function setAiEnabled(enabled: boolean): Promise<void> {
  config({ path: resolve(__dirname, '../.env') })

  const connectionString = process.env.DATABASE_URL_OWNER
  if (!connectionString) {
    throw new Error('Missing DATABASE_URL_OWNER. Copy .env.example to .env and fill it in.')
  }

  const pool = new Pool({ connectionString })
  try {
    const { rowCount } = await pool.query(
      'UPDATE system_settings SET value = $1, updated_at = now() WHERE key = $2',
      [String(enabled), SETTING_KEY_AI_ENABLED],
    )
    // A silent no-op here would leave the AI on while the spec believes it is off, and the
    // spec would then be proving nothing at all.
    if (rowCount === 0) {
      throw new Error(
        `No "${SETTING_KEY_AI_ENABLED}" row in system_settings. Run \`pnpm seed\` first.`,
      )
    }
  } finally {
    await pool.end()
  }
}
