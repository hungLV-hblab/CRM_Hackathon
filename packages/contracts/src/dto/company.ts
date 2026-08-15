import { z } from 'zod'

/**
 * The contract between the frontend and the API for `Company`. It lives in contracts so
 * `apps/web` can build screens against real types as soon as phase 1 lands, without waiting
 * for the API and without retyping anything.
 *
 * `name`, `industry` and `companyType` are required — exactly the `*` fields of ontology 3.1.
 * Validation messages stay Vietnamese: Sales reads them.
 *
 * `companyType` is free text (schema migration 0012), not `z.enum(COMPANY_TYPE)`: the real BTC
 * data does not fold into the 5-value dictionary without guessing. `COMPANY_TYPE` in `../enums`
 * is still exported as a set of SUGGESTED values for the create/edit form, not an enforced list.
 */
export const createCompanySchema = z.object({
  name: z.string().trim().min(1, 'Tên công ty không được để trống'),
  industry: z.string().trim().min(1, 'Ngành không được để trống'),
  companyType: z.string().trim().min(1, 'Loại hình công ty không được để trống'),
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

/**
 * The live-source switch, on its own endpoint rather than as a field of `updateCompanySchema`.
 *
 * It is the only company write with a refusal condition of its own (I-16), and folding it into
 * the general update would mean one request could both edit a profile cell and be refused for an
 * unrelated reason — leaving the caller unable to tell which half failed.
 */
export const setLiveSourceSchema = z.object({ enabled: z.boolean() })

export type SetLiveSourceDto = z.infer<typeof setLiveSourceSchema>

/** Search by name plus the four filters of the list screen. All optional, all combinable. */
export interface ListCompaniesQuery {
  q?: string
  industry?: string
  companyType?: string
  country?: string
  isWatched?: boolean
  /**
   * ABSENT MEANS EVERY ROW, not "page one" (ADR-0047).
   *
   * Five of the six screens that read this endpoint want the whole list — the deal board, Đang
   * theo dõi, the command palette, the admin snapshot switch, and the filter dropdowns on the
   * company screen itself. Defaulting an absent `page` to 20 rows would have truncated all five
   * silently, which is the failure mode worth designing against: nobody notices a list that is
   * merely shorter than it should be.
   */
  page?: number
  pageSize?: number
  /** Ordering is decided by the SERVER once the list is paged; sorting a page in the browser would only sort that page. */
  sortBy?: 'name' | 'industry'
  sortDir?: 'asc' | 'desc'
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
  /**
   * Whether this company reads the live web source as well as (never instead of) the stored
   * snapshot — ADR-0035. Off by default, and refused outright for companies of the seed set
   * (I-16), so the acceptance suite stays reproducible.
   */
  liveSourceEnabled: boolean
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
