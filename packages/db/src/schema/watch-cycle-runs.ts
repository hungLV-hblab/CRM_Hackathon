import { boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

/**
 * ontology 3.3 — one row of the watch-cycle log. "Vòng quét lúc 08:00 đã quét 3 công ty
 * Đang theo dõi" (`scanned`).
 *
 * A SKIPPED tick also writes a row, with `skippedReason`. That is what makes I-10 and T-9
 * provable: with no row at all you cannot tell "the system is switched off" from "the
 * system is dead".
 */
export const watchCycleRuns = pgTable('watch_cycle_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  durationMs: integer('duration_ms'),
  companiesScanned: integer('companies_scanned').notNull().default(0),
  newContentCount: integer('new_content_count').notNull().default(0),
  entriesAdded: integer('entries_added').notNull().default(0),
  errorCount: integer('error_count').notNull().default(0),
  errorDetail: text('error_detail'),
  /** `ai_disabled` | `previous_cycle_running` | null (null means the tick really ran). */
  skippedReason: text('skipped_reason'),
  /** Rolls several quiet ticks into one row — unused in the skeleton, belongs to group 5. */
  isRollup: boolean('is_rollup').notNull().default(false),
  cyclesCovered: integer('cycles_covered').notNull().default(1),
})

export type WatchCycleRun = typeof watchCycleRuns.$inferSelect

export const SKIP_REASON_AI_DISABLED = 'ai_disabled'
export const SKIP_REASON_PREVIOUS_CYCLE_RUNNING = 'previous_cycle_running'
