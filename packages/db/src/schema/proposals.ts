import { check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

import { claims } from './claims'
import { companies } from './companies'
import { opportunities } from './opportunities'
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
 *
 * The third branch is I-7 (ADR-0023): feature group 4 refuses to overwrite a next step a
 * human typed and raises a proposal instead. It needs `opportunityId`, because a next step
 * belongs to a DEAL and a company can have several open ones — a proposal that cannot say
 * which deal cannot be decided. `next_step` is not an I-11 exception: I-11 lists company
 * PROFILE fields, and this branch never touches one.
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
    /**
     * NULL for `timeline_entry`; one of the I-11 whitelist for `field_update`;
     * `next_step_text` for `next_step`.
     */
    targetField: text('target_field'),
    /** `next_step` only — which deal's next step is being proposed (ADR-0023). */
    opportunityId: uuid('opportunity_id').references(() => opportunities.id),
    /** What the field holds right now, so the reviewer sees what would be overwritten. */
    currentValue: text('current_value'),
    proposedValue: text('proposed_value').notNull(),
    /** Shown next to the accept/reject buttons: what breaks if this is wrong. */
    impactIfWrong: text('impact_if_wrong'),
    status: proposalStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /**
     * `proposal_type::text` rather than the bare enum column, and that cast is load-bearing.
     *
     * `next_step` is added to the type by the same migration that writes this constraint, and
     * Postgres refuses to USE a new enum label in the transaction that added it (55P04,
     * "unsafe use of new value"). Drizzle runs all pending migrations in ONE transaction, so
     * on a fresh database — every test run, every judge replay — the enum literal form fails
     * outright. Comparing text to text never touches the enum type.
     */
    check(
      'proposals_target_field_matches_type',
      sql`(${table.proposalType}::text = 'field_update'
             AND ${table.targetField} IN ('industry', 'country', 'size', 'website')
             AND ${table.opportunityId} IS NULL)
          OR (${table.proposalType}::text = 'timeline_entry'
             AND ${table.targetField} IS NULL
             AND ${table.opportunityId} IS NULL)
          OR (${table.proposalType}::text = 'next_step'
             AND ${table.targetField} = 'next_step_text'
             AND ${table.opportunityId} IS NOT NULL)`,
    ),
    /** The review queue reads `status = 'pending'`; keep that lookup cheap. */
    index('proposals_status_created_at_idx').on(table.status, table.createdAt),
  ],
)

export type Proposal = typeof proposals.$inferSelect
