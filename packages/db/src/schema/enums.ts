import { pgEnum } from 'drizzle-orm/pg-core'

import {
  COMPANY_TYPE,
  CONFIDENCE,
  CREATED_BY,
  DECISION,
  ENTRY_TYPE,
  FETCH_STATUS,
  NEXT_STEP_SOURCE,
  PROPOSAL_STATUS,
  PROPOSAL_TYPE,
  REJECT_REASON,
  SIGNAL_TYPE,
  STAGE,
  TRIGGER_CONTEXT,
  USER_ROLE,
  enumCodes,
} from '@crm/contracts'

/**
 * Postgres enum types are generated DIRECTLY from `@crm/contracts` — no value is retyped
 * here. This is the link that keeps the ontology from becoming decoration (CLAUDE.md
 * section 8): change the ontology → contracts test goes red → fix `enums.ts` → the next
 * generated migration comes out different.
 *
 * All enums are declared even though the skeleton uses 5: adding a value to a Postgres
 * enum later needs `ALTER TYPE`, which costs far more than declaring them once now.
 */
export const companyTypeEnum = pgEnum('company_type', enumCodes(COMPANY_TYPE))
export const stageEnum = pgEnum('stage', enumCodes(STAGE))
export const signalTypeEnum = pgEnum('signal_type', enumCodes(SIGNAL_TYPE))
export const confidenceEnum = pgEnum('confidence', enumCodes(CONFIDENCE))
export const proposalTypeEnum = pgEnum('proposal_type', enumCodes(PROPOSAL_TYPE))
/** ADR-0016 — queue flag only, NOT a mirror of `decision`. Every number reads `decision`. */
export const proposalStatusEnum = pgEnum('proposal_status', enumCodes(PROPOSAL_STATUS))
export const decisionEnum = pgEnum('decision', enumCodes(DECISION))
export const rejectReasonEnum = pgEnum('reject_reason', enumCodes(REJECT_REASON))

/**
 * `next_step_source` and `created_by` share a value set but the ontology declares them as
 * two enums, so they get two Postgres types. Merging them removes the ability for either
 * to evolve on its own.
 */
export const nextStepSourceEnum = pgEnum('next_step_source', enumCodes(NEXT_STEP_SOURCE))
export const createdByEnum = pgEnum('created_by', enumCodes(CREATED_BY))

export const triggerContextEnum = pgEnum('trigger_context', enumCodes(TRIGGER_CONTEXT))
export const entryTypeEnum = pgEnum('entry_type', enumCodes(ENTRY_TYPE))
export const fetchStatusEnum = pgEnum('fetch_status', enumCodes(FETCH_STATUS))

/** Not part of table 3.5 — see the note on `USER_ROLE` in contracts. */
export const userRoleEnum = pgEnum('user_role', enumCodes(USER_ROLE))
