import type { Confidence, SignalType, TriggerContext } from '../enums'

/**
 * Port for extracting a `Claim` from an `Observation`.
 *
 * The walking skeleton ships NO adapter, on purpose. The port exists early so feature group
 * 2 can plug `AnthropicClaimExtractor` in without changing any call site, and so its tests
 * can plug in a fixture reader.
 *
 * Two provenance rules live outside this port — never let the LLM declare them:
 * - I-1: a `Claim` without `quoteText` MUST be rejected at save time.
 * - I-2: `quoteText` must be a verbatim substring of `Observation.rawContent`; the
 *   quote_start/quote_end offsets are COMPUTED BY CODE, never accepted from the LLM.
 *   That is why `ClaimDraft` deliberately has no offset fields.
 */
export interface ObservationInput {
  id: string
  companyId: string
  /** Raw snapshot content. Every quote must be a verbatim substring of this string. */
  rawContent: string
  /** ontology section 4: `Claim` `read_under_lens_of` `company_type`. */
  companyType: string
  triggerContext: TriggerContext
}

export interface ClaimDraft {
  statement: string
  signalType: SignalType
  confidence: Confidence
  /** Verbatim from `rawContent`. A paraphrase is fake provenance and I-2 rejects it. */
  quoteText: string
}

export interface ClaimExtractor {
  extract(observation: ObservationInput): Promise<ClaimDraft[]>
}

/** DI token kept in contracts so api and worker share one string instead of retyping it. */
export const CLAIM_EXTRACTOR = 'CLAIM_EXTRACTOR'
