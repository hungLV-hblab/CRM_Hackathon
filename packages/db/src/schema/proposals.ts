import { check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

import { claims } from './claims'
import { companies } from './companies'
import { proposalStatusEnum, proposalTypeEnum } from './enums'

/**
 * ontology 3.2 — "gợi ý". Autonomy zone 2: the AI only ever GENERATES these; nothing happens
 * until a human decides, indefinitely (CLAUDE.md section 4). A proposal never expires into
 * an action.
 *
 * Two database-level guarantees, both of which T-4 depends on:
 *
 * 1. `status` DEFAULTS to `pending` and is ABSENT from the `GRANT INSERT` column list of
 *    `crm_system` (ADR-0015, `0002_grants_ai_tables.sql`). So the AI cannot insert a
 *    pre-approved proposal — not because the service remembers to set `pending`, but because
 *    it holds no privilege on the column. `status` is a queue flag only: every NUMBER comes
 *    from `proposal_decisions` (ADR-0016).
 *
 * 2. The CHECK below enforces I-11, and it is CONDITIONAL on `proposalType` on purpose. A
 *    flat whitelist would reject the `timeline_entry` kind, which has no target field at all
 *    and must carry NULL. Written this way it covers both halves of I-11 (the allowed set
 *    AND the ban on `name` / `company_type`) and additionally pins the type↔field pairing.
 *    `company_type` is banned because it is the lens signals are read under — letting a
 *    proposal edit it creates a self-referential loop.
 */
export const proposals = pgTable(
  'proposals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    /** Provenance: every proposal points back at the claim that produced it (ontology 3.2). */
    claimId: uuid('claim_id')
      .notNull()
      .references(() => claims.id),
    proposalType: proposalTypeEnum('proposal_type').notNull(),
    /** NULL for `timeline_entry`; one of the I-11 whitelist for `field_update`. */
    targetField: text('target_field'),
    /** What the field holds right now, so the reviewer sees what would be overwritten. */
    currentValue: text('current_value'),
    proposedValue: text('proposed_value').notNull(),
    /** Shown next to the accept/reject buttons: what breaks if this is wrong. */
    impactIfWrong: text('impact_if_wrong'),
    status: proposalStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'proposals_target_field_matches_type',
      sql`(${table.proposalType} = 'field_update'
             AND ${table.targetField} IN ('industry', 'country', 'size', 'website'))
          OR (${table.proposalType} = 'timeline_entry' AND ${table.targetField} IS NULL)`,
    ),
    /** The review queue reads `status = 'pending'`; keep that lookup cheap. */
    index('proposals_status_created_at_idx').on(table.status, table.createdAt),
  ],
)

export type Proposal = typeof proposals.$inferSelect
