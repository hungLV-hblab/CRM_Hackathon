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
