import { date, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

import { claims } from './claims'
import { nextStepSourceEnum } from './enums'
import { opportunities } from './opportunities'
import { users } from './users'

/**
 * ontology 3.3 — "lần hệ thống tự đặt Việc tiếp theo". Autonomy zone 3: the AI writes to
 * official data without asking, and the safety mechanism is not a review queue but
 * ONE-CLICK UNDO within 7 days plus a two-way trail (CLAUDE.md section 4).
 *
 * This table IS that trail, which is why its columns are split across two privilege groups
 * (ADR-0015, `0002_grants_ai_tables.sql`):
 *
 * - `crm_system` may INSERT the "what I did" half: the `previous*` / `new*` pairs.
 * - `crm_system` may NOT write `undoDeadline` (its DEFAULT below fixes the window) and may
 *   not write any `undone*` column, and holds no UPDATE at all. Undo is a human clicking a
 *   button, recorded by `crm_app`.
 *
 * Without that split the AI could insert `undo_deadline = now()`, and the 7-day guarantee of
 * T-7 would evaporate while every existing test stayed green.
 *
 * I-8: `undoneTo*` restores the LAST HUMAN-TYPED value (empty if there never was one), not
 * the machine's previous guess. The point of the button is protecting human data, not
 * providing version history — so `previousSource` is stored to make that decidable.
 */
export const autoNextStepEvents = pgTable('auto_next_step_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  opportunityId: uuid('opportunity_id')
    .notNull()
    .references(() => opportunities.id),
  /** Provenance: which claim justified this write. Zone 3 is still "no source, no display". */
  claimId: uuid('claim_id')
    .notNull()
    .references(() => claims.id),

  previousText: text('previous_text'),
  previousDueDate: date('previous_due_date'),
  previousSource: nextStepSourceEnum('previous_source'),

  newText: text('new_text').notNull(),
  /** From the I-9 urgency table (`signal_type` → days), never chosen by the LLM. */
  newDueDate: date('new_due_date'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  /**
   * The 7-day undo window. DEFAULT rather than a value passed in by the caller, because
   * `crm_system` deliberately has no INSERT privilege on this column.
   */
  undoDeadline: timestamp('undo_deadline', { withTimezone: true })
    .notNull()
    .default(sql`now() + interval '7 days'`),

  undoneAt: timestamp('undone_at', { withTimezone: true }),
  undoneBy: uuid('undone_by').references(() => users.id),
  undoneToText: text('undone_to_text'),
  undoneToDueDate: date('undone_to_due_date'),
})

export type AutoNextStepEvent = typeof autoNextStepEvents.$inferSelect
