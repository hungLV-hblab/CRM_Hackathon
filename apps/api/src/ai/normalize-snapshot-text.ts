import { createHash } from 'node:crypto'

/**
 * The ONE place a snapshot turns from HTML into text. ADR-0012 makes this function
 * load-bearing rather than a utility:
 *
 * - `quote_start` / `quote_end` on `Claim` are offsets into the RESULT of this function.
 * - `content_hash` on `Observation` is computed over the RESULT of this function (I-3).
 *
 * So two different normalisations = offsets that point at the wrong characters and a hash
 * that changes when only the markup changed. That is the failure mode phase 2 lists as a
 * risk, and the mitigation is not "be careful", it is: there is exactly one function, both
 * the writer and the highlighter call it, and `normalize-snapshot-text.test.ts` asserts the
 * round trip.
 *
 * Deliberately NOT a real HTML parser. The snapshots are stored fixtures of simple article
 * markup (crawling live sites is out of scope), and a parser dependency would add a second
 * source of normalisation behaviour that could drift between versions.
 */

/**
 * Stored on every `Observation` so old offsets stay interpretable. It lives in THIS file, next
 * to the function it describes: change the normalisation below and you bump this line, which
 * is the only way a reader can tell whether a stored `quote_start` was measured by the same
 * rules the highlighter uses today.
 */
export const EXTRACTOR_VERSION = 'snapshot-text-v1'

/** Tags whose content is markup machinery, not readable text. Dropped whole. */
const NON_TEXT_BLOCKS = /<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi

/** Tags that end a line of prose. Become a newline so sentences do not fuse together. */
const BLOCK_BOUNDARIES = /<\/?(p|div|br|li|tr|h[1-6]|section|article|header|footer|blockquote)\b[^>]*>/gi

const REMAINING_TAGS = /<[^>]+>/g

/** Only the handful that actually appear in article text. An unknown entity is left as-is. */
const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
}

/**
 * HTML → the text every quote offset is measured against.
 *
 * Idempotent by construction: running it on its own output changes nothing, which is what
 * lets the highlighter re-derive offsets from stored `raw_content` without re-reading the
 * HTML.
 */
export function normalizeSnapshotText(rawHtml: string): string {
  const withoutNonText = rawHtml.replace(NON_TEXT_BLOCKS, ' ')
  const withLineBreaks = withoutNonText.replace(BLOCK_BOUNDARIES, '\n')
  const withoutTags = withLineBreaks.replace(REMAINING_TAGS, ' ')
  const decoded = withoutTags.replace(/&[a-zA-Z#0-9]+;/g, (entity) => ENTITIES[entity] ?? entity)

  return (
    decoded
      // Collapse runs of spaces/tabs but NOT newlines: the paragraph structure is what makes
      // the "Văn bản" tab readable, and collapsing it would also shift every offset.
      .replace(/[^\S\n]+/g, ' ')
      .replace(/ ?\n ?/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )
}

/**
 * I-3 compares this against the company's most recent observation. Computed over the
 * NORMALISED text, never the HTML: a site that reorders its own markup without changing a
 * word must not read as new content — it would spam the timeline and pay for an LLM call.
 */
export function hashSnapshotContent(rawContent: string): string {
  return createHash('sha256').update(rawContent, 'utf8').digest('hex')
}

export interface QuoteSpan {
  quoteStart: number
  quoteEnd: number
}

/**
 * I-2 — the offsets are COMPUTED HERE, never accepted from the LLM. `ClaimDraft` in
 * @crm/contracts deliberately has no offset fields so there is nothing to accept.
 *
 * Returns `null` when the quote is not a verbatim substring, and the caller must then drop
 * the whole claim. A paraphrase leaves `quote_text` non-empty, so I-1 alone would pass it —
 * and then clicking the claim highlights nothing. That is fake provenance, which rule 1 of
 * CLAUDE.md rates as worse than not having the feature.
 */
export function locateVerbatimQuote(rawContent: string, quoteText: string): QuoteSpan | null {
  if (quoteText.trim().length === 0) return null

  const quoteStart = rawContent.indexOf(quoteText)
  if (quoteStart === -1) return null

  return { quoteStart, quoteEnd: quoteStart + quoteText.length }
}
