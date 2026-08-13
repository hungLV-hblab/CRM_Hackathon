import type { Stage } from '../enums'
import type { OpportunityDto } from './opportunity'

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
  lostReasons: { reason: string; count: number }[]
  lostWithoutReason: number
}
