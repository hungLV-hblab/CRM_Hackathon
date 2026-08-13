import { z } from 'zod'

import { enumCodes, STAGE, type NextStepSource, type OpportunityWarning, type Stage } from '../enums'

/**
 * The contract for `Opportunity` (ontology 3.1, feature group 1).
 *
 * READ THIS BEFORE ADDING A `.refine()` ANYWHERE IN THIS FILE. The Specs say three times that
 * feature group 1 must never block Sales: dragging to "Đủ điều kiện" with both signal cells
 * empty goes through, moving to "Thua" with no reason goes through, saving an open
 * opportunity with no next step goes through. Each of those is enforced by the ABSENCE of a
 * rule, which is the kind of evidence that disappears in a code review — hence
 * `opportunity-stage-never-blocks.test.ts`, which goes red the moment a stage-conditional
 * refinement appears here.
 *
 * Incomplete data comes back carrying a warning flag instead (`warnings` on `OpportunityDto`).
 */

/** Trimmed, and an empty string means "the user cleared this cell", i.e. `null`. */
const clearableText = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .nullish()

/** Money as a decimal STRING: `numeric` in Postgres, and a float would round money. */
const money = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, 'Giá trị dự kiến phải là số, tối đa 2 chữ số thập phân')
  .nullish()

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày hạn có dạng YYYY-MM-DD')
  .nullish()

/** ontology 3.1: expected close MONTH, not a day. */
const closeMonth = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Tháng dự kiến chốt có dạng YYYY-MM')
  .nullish()

export const createOpportunitySchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().trim().min(1, 'Tên cơ hội không được để trống'),
  expectedValue: money,
  expectedCloseMonth: closeMonth,
  /** Optional: a new opportunity starts at `prospecting`, but Sales may enter one mid-flight. */
  stage: z.enum(enumCodes(STAGE)).optional(),
  nextStepText: clearableText,
  nextStepDueDate: isoDate,
  needSignal: clearableText,
  needSignalSource: clearableText,
  budgetSignal: clearableText,
  budgetSignalSource: clearableText,
  lostReason: clearableText,
})

export type CreateOpportunityDto = z.infer<typeof createOpportunitySchema>

/** Everything but `companyId`: an opportunity does not move between companies. */
export const updateOpportunitySchema = createOpportunitySchema.omit({ companyId: true }).partial()

export type UpdateOpportunityDto = z.infer<typeof updateOpportunitySchema>

/**
 * Stage change. The five optional cells are what the transition dialog offers to collect on
 * the way — offering is not requiring, and the dialog always keeps a "Để trống, bổ sung sau"
 * button next to them.
 */
export const updateStageSchema = z.object({
  stage: z.enum(enumCodes(STAGE)),
  needSignal: clearableText,
  needSignalSource: clearableText,
  budgetSignal: clearableText,
  budgetSignalSource: clearableText,
  lostReason: clearableText,
})

export type UpdateStageDto = z.infer<typeof updateStageSchema>

export interface OpportunityDto {
  id: string
  companyId: string
  /** Denormalised for the board and the to-do list, which show the deal without its company. */
  companyName: string
  name: string
  expectedValue: string | null
  expectedCloseMonth: string | null
  stage: Stage
  nextStepText: string | null
  nextStepDueDate: string | null
  /** `system` here is what makes autonomy zone 3 visible on screen (feature group 4). */
  nextStepSource: NextStepSource | null
  needSignal: string | null
  needSignalSource: string | null
  budgetSignal: string | null
  budgetSignalSource: string | null
  lostReason: string | null
  /**
   * Derived server-side, never stored. Required rather than optional: a screen that could be
   * handed an opportunity without its flags would silently render an incomplete row as clean.
   */
  warnings: OpportunityWarning[]
  isOverdue: boolean
  updatedAt: string
}

/** Filters of the board. Both are optional — no filter means every open and closed deal. */
export interface ListOpportunitiesQuery {
  companyId?: string
  stage?: Stage
  overdueOnly?: boolean
}
