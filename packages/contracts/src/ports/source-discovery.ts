import type { SourceTier } from '../enums'

/**
 * Finding candidate sources for a company — the ONE thing the LLM decides in the live path
 * (ADR-0036).
 *
 * The boundary this port draws is the most important line of the whole feature:
 *
 *   LLM  → WHERE to read. A search index knows which pages exist; a model is good at telling
 *          which of them are about this company rather than a namesake.
 *   code → WHAT gets stored and how it is quoted. `LiveCrawlSource` fetches the bytes,
 *          `normalizeSnapshotText` turns them into the string every offset is measured against,
 *          and `ClaimExtractor` draws findings through the I-1/I-2 gates.
 *
 * So an implementation of this port may return URLs and the snippets around them, and may never
 * return page CONTENT. Anthropic's `web_fetch` would hand back the page already read and
 * summarised, which is exactly the thing that cannot be allowed: ADR-0012 computes `content_hash`
 * and every `quote_start`/`quote_end` over OUR normalisation of OUR bytes, so a page this
 * codebase never held has nothing for I-2 to check a quote against, and rule 1 goes with it.
 *
 * A CANDIDATE IS NOT A SOURCE, and that stays true now that candidates are stored (ADR-0037). What
 * this port returns is written to `company_source_candidates` — a table the AI identity holds no
 * privilege on and no reader acts on. A person ticks the ones that are really about their company,
 * and only that click writes `company_sources`, which is the list the crawler is shown.
 */

export interface SourceCandidate {
  url: string
  sourceTier: SourceTier
  /** The passage the search returned around this result — why a person should keep it. */
  snippet: string
  /** One sentence in Vietnamese: why this URL is about THIS company. Shown next to the tick. */
  reason: string
}

export interface SourceDiscoveryInput {
  companyName: string
  /** Used to recognise the company's own domain among results; `null` when nobody typed one. */
  companyWebsite: string | null
  companyType: string
}

export interface SourceDiscovery {
  /**
   * Returns candidates; storing them is the service's business, not this port's. An empty list is
   * an answer — "no page I can vouch for" beats a plausible URL nobody can trace (rule 4).
   */
  discover(input: SourceDiscoveryInput): Promise<SourceCandidate[]>
}

/**
 * DI token kept in contracts so api and worker share one string instead of retyping it — a plain
 * string, not a `Symbol`, matching `CLAIM_EXTRACTOR` rather than inventing a second convention.
 */
export const SOURCE_DISCOVERY = 'SOURCE_DISCOVERY'
