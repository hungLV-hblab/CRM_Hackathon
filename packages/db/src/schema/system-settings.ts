import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/**
 * ontology 3.4 — key/value pairs, TWO keys: `ai_enabled` and `watch_cycle_seconds`.
 *
 * This is the easiest boundary in the project to misread, so plainly: **environment
 * variables are only the INITIAL value; the EFFECTIVE value lives in this table.** The
 * watch cycle reads it every tick without caching (ADR-0011), which is what makes the AI
 * kill switch take effect immediately (T-9) and the cycle length reconfigurable without a
 * restart — while the API and the worker still need no channel between them but the database.
 *
 * `crm_system` only has SELECT here: the worker READS its parameters, it does not get to
 * change its own parameters.
 */
export const systemSettings = pgTable('system_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type SystemSetting = typeof systemSettings.$inferSelect

export const SETTING_KEY_AI_ENABLED = 'ai_enabled'
export const SETTING_KEY_WATCH_CYCLE_SECONDS = 'watch_cycle_seconds'
