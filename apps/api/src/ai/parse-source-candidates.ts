import type { Logger } from '@nestjs/common'
import { z } from 'zod'

import { SOURCE_TIER, type SourceCandidate, enumCodes } from '@crm/contracts'

/**
 * Turning a model's text into `SourceCandidate[]` — shared by every adapter behind
 * `SOURCE_DISCOVERY`, for exactly the reason `parse-claim-drafts.ts` gives for the other port.
 *
 * Extracted when `AgentSourceDiscovery` arrived. Two copies of this schema would be two answers to
 * "what counts as a well-formed candidate", and the copy that drifted would be the one nobody was
 * reading: a model naming a `sourceTier` the CHECK constraint rejects would parse cleanly here and
 * vanish on insert, with nothing erroring on the way.
 *
 * What this module deliberately does NOT decide: whether a URL may be requested (that is
 * `assertPublicUrl`) or whether it answers (that is `verifyCandidatesReachable`). Folding either
 * one in would bury a security decision inside a shape check, where nobody reviewing the gate
 * would think to look for it.
 */

const candidateSchema = z.object({
  url: z.string().trim().min(1),
  sourceTier: z.enum(enumCodes(SOURCE_TIER)),
  /** Empty is tolerated: a candidate with no excerpt is thin, not malformed. */
  snippet: z.string().trim().default(''),
  reason: z.string().trim().default(''),
})

const responseSchema = z.object({ candidates: z.array(candidateSchema) })

/**
 * A response we cannot parse yields ZERO candidates, never a thrown request (rule 4). A model that
 * starts writing prose shows up as an empty list a person can see, not as a 500 that takes the
 * company page down.
 *
 * @param context what to name in the log, so a warning points at a row somebody can go and look at.
 */
export function parseSourceCandidates(
  text: string,
  logger: Logger,
  context: string,
): SourceCandidate[] {
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

  return parsed.data.candidates
}

/**
 * The comparison key for "are these two answers the same page".
 *
 * A trailing slash and an upper-case host are the same page; treating them as different would show
 * one page twice and spend two of the six slots a person has to read. Returns `null` for anything
 * that is not a web address at all, which is how a non-URL leaves the list without a special case
 * at every call site.
 *
 * NOT a security check — `http://127.0.0.1/` normalises perfectly well. `assertPublicUrl` is the
 * gate; this is only a dictionary key.
 */
export function sourceUrlKey(url: string): string | null {
  try {
    const parsed = new URL(url.trim())
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    const path = parsed.pathname.replace(/\/+$/, '')
    return `${parsed.protocol}//${parsed.host.toLowerCase()}${path}${parsed.search}`
  } catch {
    return null
  }
}

function safeJsonParse(json: string): unknown {
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}
