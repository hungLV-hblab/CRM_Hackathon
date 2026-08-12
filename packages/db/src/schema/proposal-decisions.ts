import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { decisionEnum, rejectReasonEnum } from './enums'
import { proposals } from './proposals'
import { users } from './users'

/**
 * ontology 3.2 — "quyết định trên gợi ý". THE source of every number the dashboard shows:
 * auto-accept rate, error-detection rate, the share of `edit`, time-to-decide (ADR-0016).
 *
 * `crm_system` has NO privilege here at all — deciding is a human act by definition, so the
 * AI identity cannot even read its way into writing a row. `crm_app` writes it, in the same
 * transaction that flips `proposals.status` to `decided`.
 *
 * I-12 is structural rather than enforced: `accept` and `edit` are two distinct values of
 * `decision`, so counting them separately is the default and merging them would have to be
 * deliberate. There is no second column anywhere holding "accepted" to accidentally sum.
 */
export const proposalDecisions = pgTable('proposal_decisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  proposalId: uuid('proposal_id')
    .notNull()
    .references(() => proposals.id),
  decision: decisionEnum('decision').notNull(),
  decidedBy: uuid('decided_by')
    .notNull()
    .references(() => users.id),
  decidedAt: timestamp('decided_at', { withTimezone: true }).notNull().defaultNow(),
  /** Only for `reject` — the in-place reason menu of ADR-0008. Drives error-detection rate. */
  rejectReason: rejectReasonEnum('reject_reason'),
  /** Only for `edit` — what the human actually wrote, which is not `proposed_value`. */
  finalValue: text('final_value'),
  /** How long the reviewer took. Part of ontology section 7's measurements. */
  secondsToDecide: integer('seconds_to_decide'),
})

export type ProposalDecision = typeof proposalDecisions.$inferSelect
