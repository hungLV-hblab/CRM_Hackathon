import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { claims } from './claims'
import { companies } from './companies'
import { contacts } from './contacts'
import { createdByEnum, entryTypeEnum } from './enums'

/**
 * ontology 3.1 — "Mục này được ghi vào dòng thời gian của công ty X" (`recorded_against`).
 *
 * Merges the three things the Specs require to appear in one place (activity · stage change
 * · note), told apart by `entryType`. Entries added by the watch cycle live here too, with
 * `createdBy = 'system'` and `entryType = 'system_entry'` — that is autonomy zone 4, where
 * the AI writes without asking.
 *
 * Hence `crm_system` has INSERT here but NOT DELETE: deleting is Sales' act (I-13) and the
 * only error-detection signal feature group 5 produces.
 */
export const timelineEntries = pgTable('timeline_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id),
  entryType: entryTypeEnum('entry_type').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  description: text('description').notNull(),
  /** Which contact the activity was with, when the entry records one. */
  contactId: uuid('contact_id').references(() => contacts.id),
  createdBy: createdByEnum('created_by').notNull(),
  /**
   * Back-reference for the `generated_from` relation (ontology section 4). Set on entries the
   * watch cycle added (zone 4) and NULL on entries Sales typed — which is what makes the
   * "do hệ thống thêm" label and its quote reachable from the timeline row.
   */
  sourceClaimId: uuid('source_claim_id').references(() => claims.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type TimelineEntry = typeof timelineEntries.$inferSelect
