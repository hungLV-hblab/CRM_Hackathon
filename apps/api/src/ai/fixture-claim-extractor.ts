import { Injectable } from '@nestjs/common'

import type {
  ClaimDraft,
  ClaimExtractor,
  CurrentProfile,
  ObservationInput,
  SignalType,
} from '@crm/contracts'

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

/**
 * The facts block of a company page (ADR-0024): `Ngành: …`, `Trụ sở chính: …`, `Quy mô: … nhân
 * viên`, `Website: …`.
 *
 * `readValue` pulls the part that belongs in the profile cell, and it must return a VERBATIM
 * substring of the line — `ProposalService` re-checks that and drops anything else. So `Trụ sở
 * chính: Aichi, Nhật Bản` yields `Nhật Bản` by cutting at the last comma, never by rewriting.
 */
interface ProfileFactPattern {
  targetField: 'industry' | 'country' | 'size' | 'website'
  label: string
  readValue: (afterLabel: string) => string | null
}

const PROFILE_FACT_PATTERNS: ProfileFactPattern[] = [
  { targetField: 'industry', label: 'Ngành:', readValue: (value) => value },
  {
    targetField: 'country',
    label: 'Trụ sở chính:',
    // A headquarters line is "city, country". The country is the profile cell; the city is not.
    readValue: (value) => {
      const parts = value.split(',')
      return parts[parts.length - 1].trim() || null
    },
  },
  {
    targetField: 'size',
    label: 'Quy mô:',
    // "500-1000 nhân viên" → "500-1000". Cutting the unit off keeps the result a substring.
    readValue: (value) => value.replace(/nhân viên\s*$/u, '').trim() || null,
  },
  { targetField: 'website', label: 'Website:', readValue: (value) => value },
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

    drafts.push(...this.readProfileFacts(sentences, observation.currentProfile))

    return drafts
  }

  /**
   * The `field_update` half (ADR-0024). Only lines that DIFFER from the profile become drafts —
   * proposing a value the cell already holds is noise, and Specs asks for "một ô còn trống hoặc
   * đã cũ". `ProposalService` compares against the row again; this is the extractor's judgement,
   * not the guarantee.
   *
   * The statement is a claim, not a transcription: mapping `Quy mô: 1000+ nhân viên` onto the
   * `size` cell is an interpretation of the page, which is the boundary CLAUDE.md section 3
   * draws ("hễ biến đổi thông tin gốc là claim").
   */
  private readProfileFacts(sentences: string[], currentProfile: CurrentProfile): ClaimDraft[] {
    const drafts: ClaimDraft[] = []

    for (const sentence of sentences) {
      for (const pattern of PROFILE_FACT_PATTERNS) {
        if (!sentence.startsWith(pattern.label)) continue

        const value = pattern.readValue(sentence.slice(pattern.label.length).trim())
        if (!value) continue
        if ((currentProfile[pattern.targetField] ?? '').trim() === value) continue

        drafts.push({
          statement: `Trang nguồn ghi ${pattern.label} ${value}`,
          /** A profile line is not a buying signal — `other` keeps it out of the news branch. */
          signalType: 'other',
          confidence: 'certain',
          quoteText: sentence,
          fieldSuggestion: { targetField: pattern.targetField, proposedValue: value },
        })
      }
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
