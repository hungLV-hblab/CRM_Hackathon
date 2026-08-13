import { Inject, Injectable, Logger } from '@nestjs/common'
import { desc, eq, inArray, sql } from 'drizzle-orm'

import {
  NEXT_STEP_TARGET_FIELD,
  PROPOSAL_TARGET_FIELDS,
  type ClaimDto,
  type PendingProposalSummary,
  type ProposalDto,
  type ProposalTargetField,
  type ProposalType,
} from '@crm/contracts'
import {
  type CrmDatabase,
  claims,
  companies,
  observations,
  opportunities,
  proposals,
} from '@crm/db'

import { DRIZZLE_APP, DRIZZLE_SYSTEM } from '../../common/db/db.module'
import type { SavedClaim } from '../claim/claim-service'

/**
 * Autonomy zone 2 — the AI prepares, a HUMAN presses (CLAUDE.md section 4).
 *
 * This class can only ever INSERT into `proposals`. It holds no path to `companies`,
 * `timeline_entries` or `opportunities`, and `crm_system` holds no privilege on them either, so
 * "nothing happens until someone decides" is structural rather than remembered. Applying an
 * accepted proposal lives in `ProposalDecisionService`, under the human identity.
 *
 * THE THREE GATES (ADR-0024). A field suggestion arrives from an extractor, i.e. from a model,
 * and none of it is trusted:
 *
 *   G1  `targetField` must be in the I-11 whitelist. The CHECK constraint repeats this, which
 *       is what makes it hold against raw SQL too.
 *   G2  `proposedValue` must be a VERBATIM substring of the claim's quote. The quote itself
 *       already survived I-2, so a value that passes G2 is traceable, character by character,
 *       back to the source page. Fails → drop the SUGGESTION, keep the finding: the finding is
 *       readable on its own, only the field implication was unusable.
 *   G3  the value must actually differ from what the profile holds. Specs asks for "một ô còn
 *       trống hoặc đã cũ"; an extractor asserting that it differs is not evidence that it does,
 *       so the comparison is done here against the row.
 *
 * `impactIfWrong` is written by CODE from a fixed table, never by the model. It is the one line
 * Sales reads before pressing, and a model that writes it can also write an empty string.
 */

/** ADR-0024: one real sentence per field. Not decoration — this is what the reviewer weighs. */
const IMPACT_IF_WRONG: Record<ProposalTargetField, string> = {
  industry:
    'Sai ngành thì công ty bị xếp vào nhóm tiếp cận sai, và mẫu đề xuất mang đi họp cũng sai theo.',
  country:
    'Sai quốc gia trụ sở thì bộ lọc theo thị trường trả danh sách sai, và người phụ trách thị trường nhận sai deal.',
  size: 'Sai quy mô thì ước lượng số kỹ sư cần thuê ngoài lệch, kéo theo báo giá lệch.',
  website:
    'Sai website thì mọi lần đọc nguồn sau đó đọc nhầm công ty, và các phát hiện mới sẽ gắn vào hồ sơ sai.',
}

const IMPACT_TIMELINE_ENTRY =
  'Nếu tin này sai, dòng thời gian của công ty mang một sự kiện không xảy ra — người vào sau đọc lại sẽ tin là thật.'

const IMPACT_NEXT_STEP =
  'Nếu việc này sai, Sales dành buổi gọi cho một lý do không tồn tại và việc đang dở dang bị đẩy lùi.'

/** Findings a reader would act on. `speculative` never reaches the queue: rule 4 of CLAUDE.md. */
const QUEUEABLE_CONFIDENCE = ['certain', 'likely'] as const

export interface GenerateProposalsInput {
  companyId: string
  observationId: string
  savedClaims: SavedClaim[]
  /** Claims group 4 refused to write over (I-7). Each becomes a `next_step` proposal instead. */
  blockedNextSteps?: BlockedNextStep[]
}

/** The I-7 hand-off from feature group 4 (ADR-0023). */
export interface BlockedNextStep {
  claim: ClaimDto
  opportunityId: string
  /** What the human typed and the system must not overwrite. Shown as `hiện tại`. */
  currentNextStepText: string | null
  /** The next step the system WOULD have written. Becomes `proposed_value`. */
  proposedNextStepText: string
}

export interface GenerateProposalsResult {
  created: number
  droppedSuggestionNotInQuote: number
  droppedSuggestionSameAsProfile: number
  /**
   * Suppressed because the same content is already in the queue, or was already decided on
   * evidence no older than this snapshot.
   */
  droppedDuplicate: number
  blockedByWatchedCompany: number
}

@Injectable()
export class ProposalService {
  private readonly logger = new Logger('ProposalService')

  constructor(
    @Inject(DRIZZLE_SYSTEM) private readonly dbSystem: CrmDatabase,
    @Inject(DRIZZLE_APP) private readonly dbApp: CrmDatabase,
  ) {}

  /**
   * Turns the findings of one snapshot into queue entries. Every count in the result is real:
   * a suggestion silently dropped would leave the team unable to answer "how often does the
   * check fire", which ADR-0024 makes a measurement.
   */
  async generate(input: GenerateProposalsInput): Promise<GenerateProposalsResult> {
    const company = await this.loadCompany(input.companyId)
    const capturedAt = await this.observationCapturedAt(input.observationId)

    const result: GenerateProposalsResult = {
      created: 0,
      droppedSuggestionNotInQuote: 0,
      droppedSuggestionSameAsProfile: 0,
      droppedDuplicate: 0,
      blockedByWatchedCompany: 0,
    }

    const rows: (typeof proposals.$inferInsert)[] = []

    for (const { claim, fieldSuggestion } of input.savedClaims) {
      if (fieldSuggestion) {
        const row = this.buildFieldUpdate(claim, fieldSuggestion, company, result)
        if (row) rows.push(row)
      }

      const timelineRow = this.buildTimelineEntry(claim, company, result)
      if (timelineRow) rows.push(timelineRow)
    }

    for (const blocked of input.blockedNextSteps ?? []) {
      rows.push({
        companyId: input.companyId,
        claimId: blocked.claim.id,
        proposalType: 'next_step',
        targetField: NEXT_STEP_TARGET_FIELD,
        opportunityId: blocked.opportunityId,
        currentValue: blocked.currentNextStepText,
        proposedValue: blocked.proposedNextStepText,
        impactIfWrong: IMPACT_NEXT_STEP,
      })
    }

    const keepable = await this.dropDuplicates(rows, capturedAt, result)
    if (keepable.length > 0) {
      await this.insertAsSystem(keepable)
      result.created = keepable.length
    }

    this.logger.log(
      `Công ty ${input.companyId}: ${result.created} gợi ý mới · ` +
        `${result.droppedSuggestionNotInQuote} bỏ vì giá trị không có trong câu trích · ` +
        `${result.droppedSuggestionSameAsProfile} bỏ vì trùng giá trị đang có · ` +
        `${result.droppedDuplicate} bỏ vì trùng gợi ý đang chờ hoặc đã quyết · ` +
        `${result.blockedByWatchedCompany} không sinh vì công ty đang theo dõi (I-5)`,
    )

    return result
  }

  /**
   * The AI-side INSERT, written out column by column — and NOT through `db.insert().values()`.
   *
   * Drizzle's insert builder always names EVERY column of the table, filling absent ones with
   * `DEFAULT`. Naming `status` at all is enough for Postgres to refuse the whole statement,
   * because `crm_system` holds no privilege on that column (ADR-0015/ADR-0016). So the generic
   * builder cannot express what this role is allowed to do, and the fix is not to widen the
   * GRANT — widening it would hand the AI the ability to file a pre-approved suggestion, which
   * is the exact hole T-4 exists to prove closed.
   *
   * Keep this list identical to the one in `0003_grants_ai_tables.sql` plus `opportunity_id`
   * from `0006`. Comparing the two by eye is the point of writing it out.
   */
  private async insertAsSystem(rows: (typeof proposals.$inferInsert)[]): Promise<void> {
    const values = rows.map(
      (row) => sql`(${row.companyId}, ${row.claimId}, ${row.proposalType}::proposal_type,
                    ${row.targetField ?? null}, ${row.opportunityId ?? null},
                    ${row.currentValue ?? null}, ${row.proposedValue}, ${row.impactIfWrong ?? null})`,
    )

    await this.dbSystem.execute(sql`
      INSERT INTO proposals
        (company_id, claim_id, proposal_type, target_field, opportunity_id,
         current_value, proposed_value, impact_if_wrong)
      VALUES ${sql.join(values, sql`, `)}
    `)
  }

  /** G1 → G2 → G3, in that order. Any gate failing means no proposal, and a counted reason. */
  private buildFieldUpdate(
    claim: ClaimDto,
    suggestion: { targetField: string; proposedValue: string },
    company: CompanyForProposals,
    result: GenerateProposalsResult,
  ): (typeof proposals.$inferInsert) | null {
    // G1. Also enforced by the CHECK constraint, so a bug here cannot reach the table.
    if (!isProposableField(suggestion.targetField)) {
      this.logger.warn(
        `I-11: từ chối gợi ý sửa ô "${suggestion.targetField}" — ngoài whitelist hồ sơ công ty`,
      )
      return null
    }

    const proposedValue = suggestion.proposedValue.trim()

    // G2. The quote already passed I-2, so passing this means the value is traceable to source.
    if (!claim.quoteText.includes(proposedValue)) {
      result.droppedSuggestionNotInQuote += 1
      this.logger.warn(
        `Bỏ đề xuất ô ${suggestion.targetField}: "${proposedValue}" không có nguyên văn trong câu trích`,
      )
      return null
    }

    // G3. "Trống hoặc đã cũ" decided against the row, not against what the model believes.
    const currentValue = company.profile[suggestion.targetField]
    if ((currentValue ?? '').trim() === proposedValue) {
      result.droppedSuggestionSameAsProfile += 1
      return null
    }

    return {
      companyId: company.id,
      claimId: claim.id,
      proposalType: 'field_update',
      targetField: suggestion.targetField,
      currentValue,
      proposedValue,
      impactIfWrong: IMPACT_IF_WRONG[suggestion.targetField],
    }
  }

  /**
   * I-5 lives here (ADR-0006): turning on Đang theo dõi DELEGATES the writing of news to the
   * watch cycle, so proposing the same news for review as well would put it on the timeline
   * twice. Note what is NOT blocked — the profile branch above still runs for a watched company.
   */
  private buildTimelineEntry(
    claim: ClaimDto,
    company: CompanyForProposals,
    result: GenerateProposalsResult,
  ): (typeof proposals.$inferInsert) | null {
    if (!isQueueableConfidence(claim.confidence)) return null
    /** `other` is "nothing a Sales person acts on" — a profile line, typically. */
    if (claim.signalType === 'other') return null

    if (company.isWatched) {
      result.blockedByWatchedCompany += 1
      return null
    }

    return {
      companyId: company.id,
      claimId: claim.id,
      proposalType: 'timeline_entry',
      targetField: null,
      currentValue: null,
      proposedValue: claim.statement,
      impactIfWrong: IMPACT_TIMELINE_ENTRY,
    }
  }

  /**
   * Specs: *"gợi ý đã bị bỏ không sinh lại với cùng nội dung, trừ khi có bản lưu mới"* — plus the
   * case Specs does not spell out but a reviewer meets first: the same suggestion twice, both
   * still waiting.
   *
   * Two layers, and the first one is not in this file: I-3 means an unchanged page produces no
   * observation and therefore no findings, so a rejected suggestion cannot come back every 60
   * seconds. What this method adds is the case I-3 does not cover — a page that changed
   * ELSEWHERE, whose facts block still carries the value that was already judged.
   *
   * It reads `proposals.status`, NOT `proposal_decisions`, and that is a boundary decision
   * rather than a shortcut: `crm_system` holds no privilege of any kind on `proposal_decisions`
   * (0003, ADR-0016), so the AI branch cannot see who decided what or why. `status = 'decided'`
   * is all it is allowed to know, and all it needs — suppressing on ACCEPTED content as well is
   * correct, because an accepted value is already in the profile (G3 would drop it anyway) or
   * already on the timeline, and an edited-then-accepted one was seen and adjusted by a person.
   *
   * The comparison is against the observation the decided proposal came from: a suggestion is
   * suppressed only while the evidence is no newer than the evidence already judged. A genuinely
   * newer snapshot reopens it, which is exactly the escape clause Specs grants.
   */
  private async dropDuplicates(
    rows: (typeof proposals.$inferInsert)[],
    capturedAt: Date,
    result: GenerateProposalsResult,
  ): Promise<(typeof proposals.$inferInsert)[]> {
    if (rows.length === 0) return rows

    const companyIds = [...new Set(rows.map((row) => row.companyId))]
    const existing = await this.dbSystem
      .select({
        companyId: proposals.companyId,
        proposalType: proposals.proposalType,
        targetField: proposals.targetField,
        proposedValue: proposals.proposedValue,
        status: proposals.status,
        capturedAt: observations.capturedAt,
      })
      .from(proposals)
      .innerJoin(claims, eq(claims.id, proposals.claimId))
      .innerJoin(observations, eq(observations.id, claims.observationId))
      .where(inArray(proposals.companyId, companyIds))

    /**
     * A row still WAITING blocks an identical one regardless of how new the evidence is. Two
     * identical cards give the reviewer nothing to choose between and deciding one leaves the
     * other behind — measured on the demo dataset, where reading a company's `before` and then
     * its `after` page proposed the same website twice.
     *
     * A row already DECIDED blocks only while the evidence is no newer than what was judged.
     */
    const blocked = new Set(
      existing
        .filter((row) => row.status === 'pending' || row.capturedAt >= capturedAt)
        .map(contentKey),
    )

    /** Also dedupe WITHIN this batch: one page can state the same fact twice. */
    const seen = new Set<string>()

    return rows.filter((row) => {
      const key = contentKey(row)
      if (!blocked.has(key) && !seen.has(key)) {
        seen.add(key)
        return true
      }
      result.droppedDuplicate += 1
      return false
    })
  }

  /** The review queue. Human identity: Sales looking at their own work. */
  async listPending(): Promise<ProposalDto[]> {
    const rows = await this.dbApp
      .select({
        proposal: proposals,
        claim: claims,
        companyName: companies.name,
        opportunityName: opportunities.name,
      })
      .from(proposals)
      .innerJoin(claims, eq(claims.id, proposals.claimId))
      .innerJoin(companies, eq(companies.id, proposals.companyId))
      .leftJoin(opportunities, eq(opportunities.id, proposals.opportunityId))
      .where(eq(proposals.status, 'pending'))
      .orderBy(desc(proposals.createdAt))

    return rows.map((row) => toDto(row))
  }

  /**
   * `companyId → pending count`, for the badges on the company screen and the deal board. A map
   * rather than a field on `CompanyDto`: the deal list needs the count per company too, and
   * widening two DTOs to carry the same number would give the badge two sources.
   */
  async pendingSummary(): Promise<PendingProposalSummary> {
    const rows = await this.dbApp
      .select({ companyId: proposals.companyId, total: sql<number>`count(*)::int` })
      .from(proposals)
      .where(eq(proposals.status, 'pending'))
      .groupBy(proposals.companyId)

    return Object.fromEntries(rows.map((row) => [row.companyId, row.total]))
  }

  private async loadCompany(companyId: string): Promise<CompanyForProposals> {
    const [company] = await this.dbSystem
      .select({
        id: companies.id,
        isWatched: companies.isWatched,
        industry: companies.industry,
        country: companies.country,
        size: companies.size,
        website: companies.website,
      })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1)

    if (!company) throw new Error(`Không tìm thấy công ty ${companyId}`)

    return {
      id: company.id,
      isWatched: company.isWatched,
      profile: {
        industry: company.industry,
        country: company.country,
        size: company.size,
        website: company.website,
      },
    }
  }

  private async observationCapturedAt(observationId: string): Promise<Date> {
    const [row] = await this.dbSystem
      .select({ capturedAt: observations.capturedAt })
      .from(observations)
      .where(eq(observations.id, observationId))
      .limit(1)

    if (!row) throw new Error(`Không tìm thấy bản lưu ${observationId}`)
    return row.capturedAt
  }
}

interface CompanyForProposals {
  id: string
  isWatched: boolean
  profile: Record<ProposalTargetField, string | null>
}

function isProposableField(field: string): field is ProposalTargetField {
  return (PROPOSAL_TARGET_FIELDS as readonly string[]).includes(field)
}

function isQueueableConfidence(confidence: string): boolean {
  return (QUEUEABLE_CONFIDENCE as readonly string[]).includes(confidence)
}

/** What "cùng nội dung" means for the no-regeneration rule. */
function contentKey(row: {
  companyId: string
  proposalType: string
  targetField?: string | null
  proposedValue: string
}): string {
  return [row.companyId, row.proposalType, row.targetField ?? '', row.proposedValue].join(' ')
}

function toDto(row: {
  proposal: typeof proposals.$inferSelect
  claim: typeof claims.$inferSelect
  companyName: string
  opportunityName: string | null
}): ProposalDto {
  const { proposal, claim } = row

  return {
    id: proposal.id,
    companyId: proposal.companyId,
    companyName: row.companyName,
    proposalType: proposal.proposalType as ProposalType,
    targetField: proposal.targetField as ProposalDto['targetField'],
    opportunityId: proposal.opportunityId,
    opportunityName: row.opportunityName,
    currentValue: proposal.currentValue,
    proposedValue: proposal.proposedValue,
    impactIfWrong: proposal.impactIfWrong,
    status: proposal.status,
    createdAt: proposal.createdAt.toISOString(),
    claim: {
      id: claim.id,
      companyId: claim.companyId,
      observationId: claim.observationId,
      statement: claim.statement,
      signalType: claim.signalType,
      confidence: claim.confidence,
      quoteText: claim.quoteText,
      quoteStart: claim.quoteStart,
      quoteEnd: claim.quoteEnd,
      triggerContext: claim.triggerContext,
      createdAt: claim.createdAt.toISOString(),
    },
  }
}
