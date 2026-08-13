import { Injectable } from '@nestjs/common'

import type { ClaimDraft, ClaimExtractor, ObservationInput, SignalType } from '@crm/contracts'

/**
 * The deterministic adapter behind the `CLAIM_EXTRACTOR` port. Two real jobs, neither of them
 * a mock:
 *
 * 1. Tests NEVER call the network (ADR-0014). A network call in the acceptance suite makes
 *    T-2/T-2b/I-3 non-deterministic and makes the whole 10-point suite depend on an API key.
 * 2. It is the rollback path of ADR-0014: one environment variable and the demo runs without
 *    an API key at all.
 *
 * It is NOT fake data. It reads the actual snapshot text and returns actual verbatim
 * substrings of it — the quote it produces has to survive the same I-2 check as the LLM's.
 * What it does not do is understand context, so it only recognises phrasings listed below.
 *
 * `confidence` here is a PROPOSAL. `ClaimService` applies the ADR-0007 gate afterwards and
 * downgrades `certain` when the statement carries a number or a proper noun the quote does
 * not contain — that gate must bite for this adapter exactly as it does for the LLM.
 */

interface SignalPattern {
  signalType: SignalType
  /** Matched case-insensitively against the normalised snapshot text. */
  keywords: string[]
  /** What the finding asserts, filled with the matched sentence's subject-free summary. */
  statementPrefix: string
}

const SIGNAL_PATTERNS: SignalPattern[] = [
  {
    signalType: 'funding',
    keywords: ['gọi vốn', 'vòng series', 'series a', 'series b', 'series c', 'huy động', 'funding round', 'raised'],
    statementPrefix: 'Công ty vừa gọi vốn',
  },
  {
    signalType: 'leadership_hire',
    keywords: ['bổ nhiệm', 'tân ceo', 'giám đốc công nghệ mới', 'cto mới', 'appoints', 'new cto', 'new cio'],
    statementPrefix: 'Công ty có nhân sự cấp cao mới',
  },
  {
    signalType: 'expansion',
    keywords: ['mở rộng', 'mở chi nhánh', 'thị trường mới', 'expands', 'new office'],
    statementPrefix: 'Công ty đang mở rộng',
  },
  {
    signalType: 'mass_hiring',
    keywords: ['tuyển dụng', 'tuyển thêm', 'hiring', 'headcount'],
    statementPrefix: 'Công ty đang tuyển dụng quy mô lớn',
  },
  {
    signalType: 'new_business_line',
    keywords: ['ra mắt', 'mảng kinh doanh mới', 'sản phẩm mới', 'launches', 'new business line'],
    statementPrefix: 'Công ty mở mảng kinh doanh mới',
  },
]

/** Sentence boundaries of the normalised text. Newlines count: paragraphs are boundaries too. */
function splitIntoSentences(rawContent: string): string[] {
  return rawContent
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0)
}

@Injectable()
export class FixtureClaimExtractor implements ClaimExtractor {
  async extract(observation: ObservationInput): Promise<ClaimDraft[]> {
    const sentences = splitIntoSentences(observation.rawContent)
    const drafts: ClaimDraft[] = []
    const usedSignals = new Set<SignalType>()

    for (const sentence of sentences) {
      const lower = sentence.toLowerCase()
      const pattern = SIGNAL_PATTERNS.find((candidate) =>
        candidate.keywords.some((keyword) => lower.includes(keyword)),
      )
      // One finding per signal type per snapshot: the same news repeated in two paragraphs is
      // one piece of news, and duplicating it would inflate the review queue.
      if (!pattern || usedSignals.has(pattern.signalType)) continue
      usedSignals.add(pattern.signalType)

      drafts.push({
        statement: `${pattern.statementPrefix} (đọc dưới góc ${observation.companyType})`,
        signalType: pattern.signalType,
        confidence: hasNumber(sentence) ? 'certain' : 'likely',
        // VERBATIM, straight out of `rawContent`. Trimming the sentence is safe because the
        // trimmed form is still a substring; rewriting any character would not be.
        quoteText: sentence,
      })
    }

    return drafts
  }
}

/**
 * A sentence carrying a figure ("20 triệu USD", "Series B") is the kind a reader acts on
 * without re-checking, so the adapter proposes `certain` there and lets the ADR-0007 gate in
 * `ClaimService` have the final say.
 */
function hasNumber(sentence: string): boolean {
  return /\d/.test(sentence)
}
