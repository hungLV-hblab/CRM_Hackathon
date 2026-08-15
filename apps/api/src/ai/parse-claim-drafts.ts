import type { Logger } from '@nestjs/common'
import { z } from 'zod'

import {
  CONFIDENCE,
  PROPOSAL_TARGET_FIELDS,
  SIGNAL_TYPE,
  type ClaimDraft,
  enumCodes,
} from '@crm/contracts'

/**
 * Turning a model's text into `ClaimDraft[]` — shared by every adapter behind `CLAIM_EXTRACTOR`,
 * because the answer has to mean the same thing whichever transport carried it.
 *
 * Extracted when the second adapter arrived (`AgentClaimExtractor`, which reaches the model
 * through the Claude CLI rather than the SDK). Two copies of this schema would be two answers
 * to "what counts as a well-formed finding", and the copy that drifted would be the one nobody
 * was reading — a model offering a signal type the database rejects would parse cleanly here
 * and vanish later, with nothing erroring on the way.
 */

/**
 * Note what this schema does NOT have: offset fields. `ClaimDraft` has none either, so a model
 * that volunteers `quote_start` cannot smuggle it past — offsets are computed by code (I-2),
 * never accepted from the LLM.
 */
const claimDraftSchema = z.object({
  statement: z.string().trim().min(1),
  signalType: z.enum(enumCodes(SIGNAL_TYPE)),
  confidence: z.enum(enumCodes(CONFIDENCE)),
  quoteText: z.string().trim().min(1),
  /**
   * ADR-0024. `targetField` is validated against the I-11 whitelist by `ProposalService`, not
   * here: a model naming a field it may not touch must surface as a refusal that is counted,
   * not as a parse failure that silently drops the whole finding.
   */
  fieldSuggestion: z
    .object({
      targetField: z.enum(PROPOSAL_TARGET_FIELDS),
      proposedValue: z.string().trim().min(1),
    })
    .optional(),
})

const responseSchema = z.object({ claims: z.array(claimDraftSchema) })

/**
 * A response we cannot parse yields ZERO findings, never a thrown request.
 *
 * Rule 4 of CLAUDE.md: an empty row beats a wrong one. The caller records the count, so a model
 * that starts answering in prose shows up as a drop in findings on the dashboard rather than as
 * a 500 that takes the whole watch cycle down with it.
 *
 * @param context what to name in the log — an observation id, a company name — so a warning
 *                points at the row somebody can go and look at.
 */
export function parseClaimDrafts(text: string, logger: Logger, context: string): ClaimDraft[] {
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
  if (json.length === 0) {
    logger.warn(`Model trả về không phải JSON cho ${context}`)
    return []
  }

  const parsed = responseSchema.safeParse(safeJsonParse(json))
  if (!parsed.success) {
    logger.warn(`Model trả JSON sai hình dạng cho ${context}: ${parsed.error.message}`)
    return []
  }

  return parsed.data.claims
}

function safeJsonParse(json: string): unknown {
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}
