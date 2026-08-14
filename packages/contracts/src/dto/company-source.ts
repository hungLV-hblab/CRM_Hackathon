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
  /**
   * Whether this page is currently being read (ADR-0037). `false` keeps the row, the snippet and
   * the person who kept it while the live path skips it — a paused source, not a deleted one.
   */
  enabled: boolean
}

/**
 * One stored candidate as it travels to the screen — what a search OFFERED for this company.
 *
 * Deliberately NOT a `CompanySourceDto`, and the difference is not shape but meaning: a row here
 * says "a search suggested this URL", a `CompanySourceDto` says "a person kept it". They live in
 * two tables for that reason (ADR-0037), and `crm_system` can read neither this list nor write it.
 */
export interface CompanySourceCandidateDto {
  id: string
  companyId: string
  url: string
  sourceTier: string
  /** Why this URL is about THIS company — the sentence a person reads to decide. Never empty. */
  reason: string
  snippet: string | null
  foundAt: string
  foundBy: string | null
  /**
   * The id of the `company_sources` row with the same URL, or `null` when there is none.
   *
   * DERIVED by joining on the URL rather than stored as a flag: "is this candidate in the reading
   * list" has exactly one answer — whether the reading list contains it — and a second column
   * would be a copy of that answer able to drift from it.
   */
  savedSourceId: string | null
}

/**
 * One candidate as the discovery port hands it over, before anything is stored.
 *
 * Kept separate from `CompanySourceCandidateDto` because it genuinely has no id yet: the search has
 * returned, the row has not been written. The service turns one into the other.
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

/**
 * How many candidates one search may leave behind — SIX, and this is not a second number invented
 * for the table (ADR-0037).
 *
 * The reason belongs to the person reading them, not to the database: someone has to read and tick
 * every row, so six is a decision and a dozen is a chore. `AnthropicSourceDiscovery` already cut
 * its results here, and this constant is that same cut lifted out so the storage path and the
 * search path cannot drift to two different answers.
 *
 * Applied in the service by slicing what came back, NOT in a zod schema: this is a machine result
 * being bounded, not user input being validated — a search that finds seven good pages should keep
 * six of them, not be rejected.
 */
export const MAX_CANDIDATES_PER_COMPANY = 6

/**
 * Pause or resume reading one saved page. The whole body is one boolean because that is the whole
 * decision — anything else about a source is changed by removing it and keeping another.
 */
export const toggleCompanySourceSchema = z.object({ enabled: z.boolean() })

export type ToggleCompanySourceDto = z.infer<typeof toggleCompanySourceSchema>

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
