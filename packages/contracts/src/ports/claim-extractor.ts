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
  /**
   * What the four proposable profile fields hold RIGHT NOW (ADR-0024). Passed in so the
   * extractor only suggests a field that is blank or stale — the judgement Specs group 3 asks
   * for ("điền hoặc sửa một ô còn trống hoặc đã cũ"). It is a HINT, not a guarantee: code
   * compares against the profile again before a proposal is created, because an extractor
   * claiming "this differs" is not evidence that it differs.
   */
  currentProfile: CurrentProfile
}

/** The I-11 whitelist as it stands in the database, for the extractor to compare against. */
export interface CurrentProfile {
  industry: string | null
  country: string | null
  size: string | null
  website: string | null
}

/**
 * An optional second half of a draft: "and this finding implies the profile field X should
 * read Y" (ADR-0024).
 *
 * Optional on purpose — a finding with no field implication is the normal case and stays
 * fully valid. `proposedValue` must be a VERBATIM substring of `quoteText`, which the domain
 * re-checks; a value that is not in the quote cannot be traced to the source and is dropped
 * (the suggestion only — the finding itself survives).
 */
export interface FieldSuggestion {
  /** One of `PROPOSAL_TARGET_FIELDS`. Validated by code, never trusted from the model. */
  targetField: string
  proposedValue: string
}

export interface ClaimDraft {
  statement: string
  signalType: SignalType
  confidence: Confidence
  /** Verbatim from `rawContent`. A paraphrase is fake provenance and I-2 rejects it. */
  quoteText: string
  fieldSuggestion?: FieldSuggestion
}

export interface ClaimExtractor {
  extract(observation: ObservationInput): Promise<ClaimDraft[]>
}

/** DI token kept in contracts so api and worker share one string instead of retyping it. */
export const CLAIM_EXTRACTOR = 'CLAIM_EXTRACTOR'
