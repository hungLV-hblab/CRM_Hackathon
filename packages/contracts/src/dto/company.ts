import { z } from 'zod'

import { enumCodes, COMPANY_TYPE } from '../enums'

/**
 * The contract between the frontend and the API for `Company`. It lives in contracts so
 * `apps/web` can build screens against real types as soon as phase 1 lands, without waiting
 * for the API and without retyping anything.
 *
 * `name`, `industry` and `companyType` are required — exactly the `*` fields of ontology 3.1.
 * Validation messages stay Vietnamese: Sales reads them.
 */
export const createCompanySchema = z.object({
  name: z.string().trim().min(1, 'Tên công ty không được để trống'),
  industry: z.string().trim().min(1, 'Ngành không được để trống'),
  companyType: z.enum(enumCodes(COMPANY_TYPE)),
  country: z.string().trim().min(1).optional(),
  size: z.string().trim().min(1).optional(),
  website: z.string().url('Website phải là một URL hợp lệ').optional(),
})

export type CreateCompanyDto = z.infer<typeof createCompanySchema>

/**
 * Every profile cell is editable BY A HUMAN, `companyType` included.
 *
 * I-11 forbids a `Proposal` from editing `companyType` because it is the lens signals are
 * read under, and editing the lens with the thing that reads through it is a self-referential
 * loop. That constraint is about the AI, not about Sales: locking the cell for everyone would
 * block an ordinary correction and leave "delete the company and start over" as the only fix
 * for a typo made at creation.
 *
 * `isWatched` is here too — turning watching on is what delegates news-writing to the system
 * (ADR-0006), and that has to be a human's decision.
 */
export const updateCompanySchema = createCompanySchema
  .extend({ isWatched: z.boolean() })
  .partial()

export type UpdateCompanyDto = z.infer<typeof updateCompanySchema>

/** Search by name plus the four filters of the list screen. All optional, all combinable. */
export interface ListCompaniesQuery {
  q?: string
  industry?: string
  companyType?: string
  country?: string
  isWatched?: boolean
}

export interface CompanyDto {
  id: string
  name: string
  industry: string
  companyType: string
  country: string | null
  size: string | null
  website: string | null
  isWatched: boolean
}

export const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(1, 'Mật khẩu không được để trống'),
})

export type LoginDto = z.infer<typeof loginSchema>

export interface UserDto {
  id: string
  email: string
  name: string
  role: string
}
