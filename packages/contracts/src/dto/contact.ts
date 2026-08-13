import { z } from 'zod'

/**
 * `Contact` — "Contact làm việc cho Company" (ontology 3.1).
 *
 * `isPrimary` is the PIC and the ontology allows EXACTLY ONE per company. The contract does
 * not try to express that: a schema can only see one contact at a time. It is enforced where
 * it can actually hold — a transaction in `ContactService` that lowers the previous PIC, and
 * the partial unique index `contacts_one_primary_per_company` underneath it.
 *
 * Setting a new PIC therefore never fails with "someone else is already primary". Making
 * Sales untick the old person first would be two actions for one intention.
 */
export const createContactSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().trim().min(1, 'Tên người liên hệ không được để trống'),
  title: z.string().trim().min(1).nullish(),
  email: z.string().trim().email('Email không hợp lệ').nullish(),
  isPrimary: z.boolean().optional(),
})

export type CreateContactDto = z.infer<typeof createContactSchema>

export const updateContactSchema = createContactSchema.omit({ companyId: true }).partial()

export type UpdateContactDto = z.infer<typeof updateContactSchema>

export interface ContactDto {
  id: string
  companyId: string
  name: string
  title: string | null
  email: string | null
  isPrimary: boolean
}
