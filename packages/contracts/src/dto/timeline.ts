import { z } from 'zod'

import type { CreatedBy, EntryType } from '../enums'

/**
 * The timeline of a company — the one place activities, stage changes and notes are read
 * together (ontology 3.1, `recorded_against`).
 *
 * Sales may only type the two entry types they author. `stage_change` is written by
 * `OpportunityService` inside the same transaction as the stage move, and `system_entry`
 * belongs to the watch cycle (autonomy zone 4) — accepting either from this endpoint would
 * let a hand-typed row claim it came from a stage change or from the machine.
 */
export const createTimelineEntrySchema = z.object({
  entryType: z.enum(['activity', 'note']),
  /** When it HAPPENED, which is not when it was typed — Sales logs calls after the fact. */
  occurredAt: z.string().datetime({ offset: true }),
  description: z.string().trim().min(1, 'Nội dung không được để trống'),
  contactId: z.string().uuid().nullish(),
})

export type CreateTimelineEntryDto = z.infer<typeof createTimelineEntrySchema>

/**
 * I-13 — Sales removing an entry the watch cycle added, WITH a short reason.
 *
 * The reason is required, and that is the whole design rather than a form nicety: it is the only
 * error-detection signal feature group 5 produces. Zone 4 writes without asking anyone, so the
 * one number that says whether it is trustworthy is how often a person had to undo it, and a
 * deletion with no reason attached is a number with no meaning behind it (ontology section 7
 * counts these in the numerator of the error-detection rate).
 *
 * Kept short on purpose — one line, not an essay. A long mandatory field is a field people learn
 * to fill with "x", at which point the metric is worse than absent because it looks populated.
 */
export const deleteSystemTimelineEntrySchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, 'Cần một lý do ngắn để xoá mục do hệ thống thêm')
    .max(280, 'Lý do nên ngắn — một dòng là đủ'),
})

export type DeleteSystemTimelineEntryDto = z.infer<typeof deleteSystemTimelineEntrySchema>

export interface TimelineEntryDto {
  id: string
  companyId: string
  entryType: EntryType
  occurredAt: string
  description: string
  contactId: string | null
  /** Name of the contact, so a row reads as a sentence without a second request. */
  contactName: string | null
  /** `system` is what the "do hệ thống thêm" label on the row is rendered from (rule 2). */
  createdBy: CreatedBy
  /** Set only on rows the watch cycle added — the way back to the quote (feature group 5). */
  sourceClaimId: string | null
  createdAt: string
}
