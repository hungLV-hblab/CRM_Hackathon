import { z } from 'zod'

import type { ClaimDto } from './claim'
import { DECISION, PROPOSAL_TYPE, REJECT_REASON, enumCodes } from '../enums'
import type { ProposalStatus, ProposalType } from '../enums'

/** I-11: the only company fields a proposal may ever target. `name` and `company_type` are banned. */
export const PROPOSAL_TARGET_FIELDS = ['industry', 'country', 'size', 'website'] as const
export type ProposalTargetField = (typeof PROPOSAL_TARGET_FIELDS)[number]

/**
 * The single `target_field` a `next_step` proposal carries (ADR-0023). It is deliberately NOT
 * a member of `PROPOSAL_TARGET_FIELDS`: that list is the I-11 whitelist of company profile
 * fields, and mixing the two would let a `field_update` aim at an opportunity column.
 */
export const NEXT_STEP_TARGET_FIELD = 'next_step_text' as const

/**
 * ontology 3.2 — "gợi ý". Autonomy zone 2: nothing happens until a human decides, and the
 * queue never expires into an action (CLAUDE.md section 4).
 *
 * `claim` is embedded rather than referenced by id: the review row has to show the quote and
 * a way back to the source in the same render, and a reviewer deciding without the evidence
 * in front of them is exactly the trap round 2 looks for.
 *
 * `status` is only the queue flag (ADR-0016). To display what happened to a decided proposal,
 * read `decision`, not `status`.
 */
export interface ProposalDto {
  id: string
  companyId: string
  /** Shown on the card so the reviewer knows which company without a second query. */
  companyName: string
  proposalType: ProposalType
  /**
   * NULL for `timeline_entry`; one of `PROPOSAL_TARGET_FIELDS` for `field_update`;
   * `NEXT_STEP_TARGET_FIELD` for `next_step`.
   */
  targetField: ProposalTargetField | typeof NEXT_STEP_TARGET_FIELD | null
  /** Set for `next_step` only — the opportunity whose next step is being proposed (ADR-0023). */
  opportunityId: string | null
  /** `next_step` only: the reviewer must see WHICH deal, not just which company. */
  opportunityName: string | null
  /** What the field holds now, so the reviewer sees what would be overwritten. */
  currentValue: string | null
  proposedValue: string
  /** What breaks if this is wrong. Shown next to the buttons, not hidden behind a tooltip. */
  impactIfWrong: string | null
  status: ProposalStatus
  createdAt: string
  claim: ClaimDto
}

/** Map `companyId → number of pending proposals`, for the badges on the company and deal screens. */
export type PendingProposalSummary = Record<string, number>

/**
 * The one request that moves a proposal out of the queue.
 *
 * The two refinements below encode ADR-0008 and I-12 in the contract rather than in a
 * controller, so `apps/web` and `apps/api` cannot disagree about them:
 * - `reject` requires a reason. A rejection with no reason produces no error-detection signal,
 *   and that signal is half of what ontology section 7 measures.
 * - `edit` requires the value the human actually typed. Without it "Sửa rồi duyệt" is
 *   indistinguishable from "Duyệt", which is precisely what I-12 forbids.
 */
export const decideProposalSchema = z
  .object({
    decision: z.enum(enumCodes(DECISION)),
    rejectReason: z.enum(enumCodes(REJECT_REASON)).optional(),
    finalValue: z.string().trim().min(1).optional(),
    /** Measured by the client from when the row was opened. Part of ontology section 7. */
    secondsToDecide: z.number().int().nonnegative().optional(),
  })
  .refine((input) => input.decision !== 'reject' || input.rejectReason !== undefined, {
    path: ['rejectReason'],
    message: 'Bỏ gợi ý thì phải chọn lý do',
  })
  .refine((input) => input.decision !== 'edit' || input.finalValue !== undefined, {
    path: ['finalValue'],
    message: 'Sửa rồi duyệt thì phải có giá trị đã sửa',
  })

export type DecideProposalDto = z.infer<typeof decideProposalSchema>

/** Guard for the I-11 whitelist at the boundary, mirroring the CHECK constraint on the table. */
export const proposalTargetFieldSchema = z.enum(PROPOSAL_TARGET_FIELDS)
export const proposalTypeSchema = z.enum(enumCodes(PROPOSAL_TYPE))
