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
