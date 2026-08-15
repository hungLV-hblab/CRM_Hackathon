import { z } from 'zod'

import type { Stage } from '../enums'
import type { OpportunityDto } from './opportunity'

/**
 * Who the overview is computed for. The controller decides what this may be: a sales actor is
 * always pinned to themselves regardless of what the query string says (a VIEW default, not
 * authorization — ontology section 1 still does no per-owner authorization anywhere else);
 * an admin may pass any owner or none.
 */
export const overviewQuerySchema = z.object({
  ownerId: z.string().uuid().optional(),
})

export type OverviewQuery = z.infer<typeof overviewQuerySchema>

/** One row per sales user on the admin's progress table. */
export interface OverviewPerSalesRow {
  userId: string
  name: string
  /** Sum of open non-on-hold deal values — same exclusions as the running pipeline tile. */
  runningPipeline: string
  /** Counts exactly the deals `runningPipeline` sums, paused ones excluded from both. */
  openCount: number
  overdueCount: number
  missingNextStepCount: number
  pendingProposals: number
  /** Age in days of the oldest still-pending proposal, null when the queue is empty. */
  oldestPendingProposalDays: number | null
}

/**
 * The overview screen — four blocks, and the shape itself carries two product decisions.
 *
 * 1. `pipelineByStage` holds ONLY the running pipeline; `onHold` is its own field. ontology
 *    3.5 keeps `on_hold` among the open stages, but a paused deal folded into the total is a
 *    number people carry into a meeting and act on. Two fields make it impossible to sum them
 *    by accident.
 * 2. `lostWithoutReason` sits OUTSIDE `lostReasons`, not as a bucket inside it. The Specs
 *    require a lost deal with no reason to stay out of the reason statistics; a bucket named
 *    "chưa ghi" would still be a row in the table, and would still be counted by anything
 *    that adds the column up.
 */
export interface OverviewDto {
  companiesByIndustry: { industry: string; count: number }[]
  pipelineByStage: { stage: Stage; count: number; totalValue: string }[]
  onHold: { count: number; totalValue: string }
  /** Rule 5: "sáng nay tôi phải làm gì" — the block the screen exists for. */
  overdueNextSteps: OpportunityDto[]
  /** Due today through +3 days, overdue excluded — it already has its own block above. */
  dueSoon: OpportunityDto[]
  /**
   * Open deals (won/lost/on_hold excluded — a paused deal's silence is deliberate) with no
   * next step at all. Rule 5 calls the next step the deal's heartbeat; these have none.
   */
  missingNextStep: OpportunityDto[]
  /**
   * Companies no SALES owns — including any an admin created for themselves — which no
   * owner-filtered view and no per-sales row can therefore count. Stated rather than
   * silently dropped: rule 4 prefers a labeled gap to a total that quietly shrank.
   */
  unassignedCompanies: number
  /** Admin only; absent for a sales actor. One row per sales user, whole-team view. */
  perSales?: OverviewPerSalesRow[]
  lostReasons: { reason: string; count: number }[]
  lostWithoutReason: number
}
