import { Inject, Injectable, Logger } from '@nestjs/common'
import { eq, sql } from 'drizzle-orm'

import type { ClaimDto } from '@crm/contracts'
import { type CrmDatabase, companies } from '@crm/db'

import { DRIZZLE_SYSTEM } from '../common/db/db.module'
import type { SavedClaim } from '../domain/claim/claim-service'

/**
 * Autonomy zone 4 — the ONE place in the product where the AI writes to Sales' official data
 * without asking and without a queue. Specs opens exactly two such doors (CLAUDE.md section 4);
 * this is the second, and adding a third anywhere needs a new ADR, not a new branch.
 *
 * What buys the authority is not the write being small. It is the four things around it:
 *   the row is LABELLED `system` and typed `system_entry`, so rule 2 holds by eye;
 *   the row carries `source_claim_id`, so rule 1 holds by click;
 *   Sales can DELETE it with a reason, which is the error-detection signal group 5 produces;
 *   every cycle writes a `WatchCycleRun`, so the whole loop is readable after the fact.
 * Take any one of those away and this class is just an AI editing a CRM.
 *
 * ── Why this lives here and not inside `WatchCycleService` ───────────────────────────────
 * ADR-0028 makes the write conditional on the COMPANY being watched, not on who read the
 * source. A person pressing "Đọc lại nguồn" on a watched company must produce the entry too, and
 * that call never goes near the worker. So the step hangs off `ClaimReactionService`, which both
 * paths already share.
 *
 * ── The filter is a COPY, deliberately ──────────────────────────────────────────────────
 * The three conditions below are the same three in `ProposalService.buildTimelineEntry`, and
 * they are duplicated rather than shared on purpose: the two are MIRRORS of one decision — a
 * finding is news for review, or news the system writes, never both and never neither (I-5).
 * Restating them side by side is what lets one test prove the pair partition cleanly. Drift one
 * condition and the two-by-two table in the tests goes red immediately, which is the point;
 * hiding them behind a shared helper would make an asymmetric change compile silently.
 */

/** Findings a reader would act on. `speculative` never reaches official data — rule 4. */
const WRITEABLE_CONFIDENCE = ['certain', 'likely'] as const

export interface SystemTimelineEntryInput {
  companyId: string
  savedClaims: SavedClaim[]
  /**
   * When the SNAPSHOT was captured, which becomes `occurred_at`. Passed in rather than queried:
   * `ObservationService` already holds it from the `.returning()` of its own insert, so this
   * costs zero extra round trips — and `now()` would be the wrong answer anyway, dating the news
   * to the moment the cycle came round instead of to the evidence.
   */
  observationCapturedAt: Date
}

@Injectable()
export class SystemTimelineEntryService {
  private readonly logger = new Logger('SystemTimelineEntry')

  constructor(@Inject(DRIZZLE_SYSTEM) private readonly dbSystem: CrmDatabase) {}

  /** Returns how many entries were written. Zero is a real zero, and the caller logs it. */
  async react(input: SystemTimelineEntryInput): Promise<number> {
    if (input.savedClaims.length === 0) return 0

    const isWatched = await this.isWatched(input.companyId)
    if (!isWatched) {
      // I-4 in its ADR-0028 form. No delegation, no write — whoever did the reading.
      this.logger.log(
        `Công ty ${input.companyId} không theo dõi — 0 mục dòng thời gian, tin đi vào hàng đợi`,
      )
      return 0
    }

    const newsworthy = input.savedClaims
      .map((saved) => saved.claim)
      .filter((claim) => isWriteableConfidence(claim.confidence) && claim.signalType !== 'other')

    if (newsworthy.length === 0) {
      this.logger.log(`Công ty ${input.companyId}: không phát hiện nào đủ điều kiện thành tin`)
      return 0
    }

    await this.insertAsSystem(input.companyId, newsworthy, input.observationCapturedAt)

    this.logger.log(
      `Công ty ${input.companyId}: tự thêm ${newsworthy.length} mục dòng thời gian ` +
        `(vùng 4 — không hỏi duyệt, Sales xoá được kèm lý do)`,
    )
    return newsworthy.length
  }

  /**
   * Written out column by column, and NOT through `db.insert().values()`.
   *
   * Drizzle's insert builder names EVERY column of the table, filling the absent ones with
   * `DEFAULT`. Naming `created_by` at all is enough for Postgres to refuse the whole statement,
   * because 0007 does not grant `crm_system` that column — the same trap feature group 3 hit on
   * `proposals.status`. The fix is never to widen the GRANT: `created_by` is what the
   * "do hệ thống thêm" label is read from, so an AI holding it can write a row that looks like
   * something a person typed.
   *
   * Keep this list identical to the GRANT in `0007_timeline_entry_system_label.sql`. Comparing
   * the two by eye is the reason for writing it out. `contact_id` is absent from both.
   */
  private async insertAsSystem(
    companyId: string,
    claims: ClaimDto[],
    occurredAt: Date,
  ): Promise<void> {
    const values = claims.map(
      (claim) =>
        sql`(${companyId}, 'system_entry'::entry_type, ${occurredAt.toISOString()}::timestamptz,
             ${claim.statement}, ${claim.id})`,
    )

    await this.dbSystem.execute(sql`
      INSERT INTO timeline_entries
        (company_id, entry_type, occurred_at, description, source_claim_id)
      VALUES ${sql.join(values, sql`, `)}
    `)
  }

  /** `crm_system` holds SELECT on `companies` and no UPDATE — it can read the flag, never set it. */
  private async isWatched(companyId: string): Promise<boolean> {
    const [company] = await this.dbSystem
      .select({ isWatched: companies.isWatched })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1)

    if (!company) throw new Error(`Không tìm thấy công ty ${companyId}`)
    return company.isWatched
  }
}

function isWriteableConfidence(confidence: string): boolean {
  return (WRITEABLE_CONFIDENCE as readonly string[]).includes(confidence)
}
