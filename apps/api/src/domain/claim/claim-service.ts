import { Inject, Injectable, Logger } from '@nestjs/common'
import { asc, eq } from 'drizzle-orm'

import type { ClaimDraft, ClaimDto, Confidence, TriggerContext } from '@crm/contracts'
import { type CrmDatabase, claims } from '@crm/db'

import { DRIZZLE_APP, DRIZZLE_SYSTEM } from '../../common/db/db.module'
import { locateVerbatimQuote } from '../../ai/normalize-snapshot-text'

/**
 * WHERE I-1, I-2 AND THE ADR-0007 GATE LIVE. Read this file before changing anything about
 * findings — the LLM adapter is deliberately dumb precisely because the guarantees are here.
 *
 * Writes go through `DRIZZLE_SYSTEM` even when a human clicked the button. That is not a
 * mistake: creating a `Claim` is an act of autonomy zone 1, so the AI identity is the writer
 * regardless of who triggered it. Using `crm_app` here would let a future bug write anywhere
 * `crm_app` can reach, which is everywhere.
 *
 * Reads for display go through `DRIZZLE_APP`: that is Sales looking at their own screen.
 *
 * Nothing in this class can write a `TimelineEntry`, a `Company` field or an `Opportunity` —
 * not by policy but by absence. That is I-4 and the "nhóm 2 không được chạm dữ liệu chính
 * thức" rule made structural: there is no code path to grep for.
 */

export interface SaveClaimsResult {
  saved: ClaimDto[]
  proposed: number
  droppedNoVerbatimQuote: number
  downgradedFromCertain: number
}

@Injectable()
export class ClaimService {
  private readonly logger = new Logger('ClaimService')

  constructor(
    @Inject(DRIZZLE_SYSTEM) private readonly dbSystem: CrmDatabase,
    @Inject(DRIZZLE_APP) private readonly dbApp: CrmDatabase,
  ) {}

  /**
   * Turns drafts into stored findings. Three code-side gates, in this order:
   *
   * 1. I-1 — no quote at all → drop. The database repeats this (`NOT NULL` + non-blank
   *    CHECK), which is what makes T-2 provable against raw SQL.
   * 2. I-2 — the quote must be a verbatim substring of `rawContent`; offsets are COMPUTED
   *    here, never taken from the LLM. Not found → drop the WHOLE finding. Not "fix it to be
   *    close enough", not "keep it with a lower confidence": ADR-0014 rules both out, because
   *    a finding whose quote does not highlight is fake provenance.
   * 3. ADR-0007 — `certain` is the only level a reader acts on without re-checking, so it is
   *    the only one with a machine gate.
   *
   * Returns counts, and the caller surfaces them. A silently dropped finding would leave the
   * team unable to answer "how often does the check fire?" — which ADR-0014 makes a metric.
   */
  async saveDrafts(
    observationId: string,
    companyId: string,
    rawContent: string,
    triggerContext: TriggerContext,
    drafts: ClaimDraft[],
  ): Promise<SaveClaimsResult> {
    const rows: (typeof claims.$inferInsert)[] = []
    let droppedNoVerbatimQuote = 0
    let downgradedFromCertain = 0

    for (const draft of drafts) {
      const span = locateVerbatimQuote(rawContent, draft.quoteText)
      if (!span) {
        droppedNoVerbatimQuote += 1
        this.logger.warn(
          `Bỏ phát hiện vì câu trích không phải chuỗi con nguyên văn: "${draft.quoteText.slice(0, 60)}…"`,
        )
        continue
      }

      const confidence = this.gateCertainty(draft)
      if (confidence !== draft.confidence) downgradedFromCertain += 1

      rows.push({
        companyId,
        observationId,
        statement: draft.statement,
        signalType: draft.signalType,
        confidence,
        quoteText: draft.quoteText,
        quoteStart: span.quoteStart,
        quoteEnd: span.quoteEnd,
        triggerContext,
      })
    }

    const inserted = rows.length > 0 ? await this.dbSystem.insert(claims).values(rows).returning() : []

    return {
      saved: inserted.map(toDto),
      proposed: drafts.length,
      droppedNoVerbatimQuote,
      downgradedFromCertain,
    }
  }

  /** For display in the read zone. Human identity: Sales is looking at their own screen. */
  async listForObservation(observationId: string): Promise<ClaimDto[]> {
    const rows = await this.dbApp
      .select()
      .from(claims)
      .where(eq(claims.observationId, observationId))
      .orderBy(asc(claims.createdAt))

    return rows.map(toDto)
  }

  /**
   * ADR-0007 — the gate on `certain`.
   *
   * Every NUMBER and every CAPITALISED token in the statement must also appear in the quote.
   * Coarse on purpose: it does not try to judge meaning, it catches the one dangerous failure
   * — the model inventing a figure or a proper noun that is not in the source and then
   * labelling it "Chắc". Fails the check → `likely`, not dropped: the finding may well be
   * right, it just is not one a reader should act on unverified.
   */
  private gateCertainty(draft: ClaimDraft): Confidence {
    if (draft.confidence !== 'certain') return draft.confidence

    const quote = draft.quoteText
    const unsupported = extractHardTokens(draft.statement).filter((token) => !quote.includes(token))
    if (unsupported.length === 0) return 'certain'

    this.logger.log(
      `Hạ mức Chắc → Có thể: "${unsupported.join(', ')}" không có trong câu trích`,
    )
    return 'likely'
  }
}

/**
 * Numbers and capitalised words — the two token classes whose invention is both easy for a
 * model and expensive for Sales. Words that are capitalised only because they start a
 * sentence are excluded, otherwise every statement would fail the gate.
 */
export function extractHardTokens(statement: string): string[] {
  const numbers = statement.match(/\d[\d.,]*/g) ?? []

  const properNouns: string[] = []
  // Split on whitespace and keep sentence position, so a leading capital is not mistaken for
  // a proper noun.
  const sentences = statement.split(/(?<=[.!?])\s+/)
  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/)
    words.forEach((word, index) => {
      const cleaned = word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
      if (cleaned.length < 2 || index === 0) return
      if (cleaned[0] === cleaned[0].toUpperCase() && cleaned[0] !== cleaned[0].toLowerCase()) {
        properNouns.push(cleaned)
      }
    })
  }

  return [...new Set([...numbers, ...properNouns])]
}

function toDto(row: typeof claims.$inferSelect): ClaimDto {
  return {
    id: row.id,
    companyId: row.companyId,
    observationId: row.observationId,
    statement: row.statement,
    signalType: row.signalType,
    confidence: row.confidence,
    quoteText: row.quoteText,
    quoteStart: row.quoteStart,
    quoteEnd: row.quoteEnd,
    triggerContext: row.triggerContext,
    createdAt: row.createdAt.toISOString(),
  }
}
