import { z } from 'zod'

import { SOURCE_TIER, enumCodes } from '../enums'

/**
 * ontology 3.6 — the reading list of a company: which public pages the live path may fetch.
 *
 * `addedBy` travels to the client because the human ownership of this table is the feature, not
 * an implementation detail. A row whose author is invisible is indistinguishable from one the AI
 * wrote, and the whole design exists to keep those two apart.
 */
export interface CompanySourceDto {
  id: string
  companyId: string
  url: string
  sourceTier: string
  /** `web_search` — a model found it and a person kept it — or `manual` — a person typed it. */
  discoveredVia: string
  searchSnippet: string | null
  addedBy: string | null
  createdAt: string
}

/**
 * One candidate as it travels to the screen. Deliberately NOT a `CompanySourceDto`: a candidate
 * has no id because it was never stored, and the type says so.
 */
export interface SourceCandidateDto {
  url: string
  sourceTier: string
  snippet: string
  reason: string
}

/**
 * A URL must be a parseable absolute http(s) address before it is stored. The SSRF gate checks
 * the same thing again at fetch time and that is not redundant: this one keeps junk out of the
 * table, that one keeps a request off the wire, and a row that can never be read is still worth
 * refusing at the point a person can fix the typo.
 */
const sourceUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine(
    (value) => {
      try {
        const parsed = new URL(value)
        return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      } catch {
        return false
      }
    },
    { message: 'Địa chỉ nguồn phải là một URL http hoặc https hợp lệ' },
  )

/**
 * The cap is five, and it is a product decision rather than a technical limit: every saved URL is
 * one fetch and one LLM call on EVERY read of that company, so an uncapped list lets a single
 * click set an ongoing cost nobody agreed to.
 */
export const MAX_SOURCES_PER_COMPANY = 5

export const saveCompanySourcesSchema = z.object({
  sources: z
    .array(
      z.object({
        url: sourceUrlSchema,
        sourceTier: z.enum(enumCodes(SOURCE_TIER)),
        searchSnippet: z.string().trim().max(2000).optional(),
      }),
    )
    .min(1)
    .max(MAX_SOURCES_PER_COMPANY),
})

export type SaveCompanySourcesDto = z.infer<typeof saveCompanySourcesSchema>
