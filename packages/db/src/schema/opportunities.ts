import { date, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { companies } from './companies'
import { nextStepSourceEnum, stageEnum } from './enums'

/**
 * ontology 3.1 — "Cơ hội Y đang được theo đuổi tại công ty X" (`pursued_at`).
 *
 * This table is where both defence layers meet. Read it next to
 * `packages/db/migrations/0001_grants.sql`:
 * - `stage` and `expectedValue`: `actor=system` may NEVER write them (ontology section 5).
 *   At the database level `crm_system` simply holds no UPDATE privilege on those columns.
 * - `nextStepText` / `nextStepDueDate` / `nextStepSource`: the only three columns
 *   `crm_system` may write (autonomy zone 3), and only when the current source is not
 *   `human` (I-7).
 */
export const opportunities = pgTable('opportunities', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id),
  name: text('name').notNull(),
  /** `numeric`, not a float: this is money, binary rounding error is not acceptable. */
  expectedValue: numeric('expected_value', { precision: 14, scale: 2 }),
  /** `YYYY-MM` — the ontology says expected close MONTH, not a specific day. */
  expectedCloseMonth: text('expected_close_month'),
  stage: stageEnum('stage').notNull().default('prospecting'),

  nextStepText: text('next_step_text'),
  nextStepDueDate: date('next_step_due_date'),
  /**
   * I-7: when this is `human` the system must NOT overwrite the next step, not even when it
   * is overdue. This column is what makes that decidable, which is why it sits in the group
   * `crm_system` may write — the system has to mark its own writes as `system` rather than
   * passing them off as human.
   */
  nextStepSource: nextStepSourceEnum('next_step_source'),

  /**
   * The four signal columns of ontology 3.1. Free `text` in the skeleton: their final shape
   * is feature group 1's call. An empty cell beats a wrong one (CLAUDE.md rule 4).
   */
  needSignal: text('need_signal'),
  needSignalSource: text('need_signal_source'),
  budgetSignal: text('budget_signal'),
  budgetSignalSource: text('budget_signal_source'),

  lostReason: text('lost_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Opportunity = typeof opportunities.$inferSelect
