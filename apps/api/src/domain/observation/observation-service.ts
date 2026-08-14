import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { and, desc, eq } from 'drizzle-orm'

import {
  CLAIM_EXTRACTOR,
  type ClaimExtractor,
  type FetchStatus,
  type IngestResultDto,
  type ObservationDto,
  type ObservationWithClaimsDto,
  type TriggerContext,
} from '@crm/contracts'
import { type CrmDatabase, companies, observations } from '@crm/db'

import { ClaimReactionService } from '../claim/claim-reaction-service'
import { ClaimService } from '../claim/claim-service'
import { DRIZZLE_APP, DRIZZLE_SYSTEM } from '../../common/db/db.module'
import { DemoSnapshotSource, type SnapshotVariant } from '../../ai/demo-snapshots'
import { SystemSettingService } from '../../settings/system-setting-service'
import {
  EXTRACTOR_VERSION,
  hashSnapshotContent,
  normalizeSnapshotText,
} from '../../ai/normalize-snapshot-text'

/**
 * Nothing read, nothing generated. Every zero here is a real zero, not a placeholder: rule 4
 * of CLAUDE.md — an empty answer beats a plausible one.
 */
const EMPTY_RESULT: IngestResultDto = {
  observationId: null,
  unchanged: false,
  skippedReason: null,
  fetchStatus: 'ok',
  claimsProposed: 0,
  claimsSaved: 0,
  claimsDroppedNoVerbatimQuote: 0,
  claimsDowngradedFromCertain: 0,
  systemEntriesAdded: 0,
}

/**
 * Autonomy zone 1 — reading a source and recording what it said. The AI does this freely
 * because nothing here touches Sales' official data, and this class has no way to reach it:
 * it can insert into `observations` and it can ask `ClaimService` for findings. That is all.
 *
 * Writes use `DRIZZLE_SYSTEM` even when a human pressed the button. Creating an `Observation`
 * is an act of the AI branch, so the AI identity is the writer regardless of who triggered it
 * — and `crm_system` holds INSERT on exactly `observations` and `claims`, nothing else.
 */
@Injectable()
export class ObservationService {
  private readonly logger = new Logger('ObservationService')

  constructor(
    @Inject(DRIZZLE_SYSTEM) private readonly dbSystem: CrmDatabase,
    @Inject(DRIZZLE_APP) private readonly dbApp: CrmDatabase,
    @Inject(CLAIM_EXTRACTOR) private readonly extractor: ClaimExtractor,
    private readonly claims: ClaimService,
    private readonly snapshots: DemoSnapshotSource,
    private readonly settings: SystemSettingService,
    private readonly reactions: ClaimReactionService,
  ) {}

  /**
   * Read a company's source once.
   *
   * I-3 is enforced HERE rather than by a unique index, per ADR-0017: the invariant is
   * "different from the MOST RECENT snapshot", and a unique index on
   * `(company_id, content_hash)` says "different from every snapshot ever", which also rejects
   * the before → after → before sequence a judge produces when replaying the T-6/T-8 script a
   * second time.
   *
   * The expensive half of I-3 is the LLM call, so the comparison happens BEFORE the extractor
   * is touched. The test asserts the extractor was called zero times — asserting only "no new
   * row" would leave a version that still pays for the call every 60 seconds.
   */
  async ingest(
    companyId: string,
    variant: SnapshotVariant,
    triggerContext: TriggerContext,
  ): Promise<IngestResultDto> {
    /**
     * ADR-0009 — the AI kill switch stops NEW generation, and reading a source by hand is a
     * generation path just like the watch cycle. Checked first, and read fresh from the
     * database every call for the same reason the worker does: a cached value would make the
     * switch take effect "eventually", which is not what T-9 asks for.
     */
    const parameters = await this.settings.read()
    if (!parameters.aiEnabled) {
      this.logger.log(`Bỏ qua đọc nguồn công ty ${companyId}: AI đang tắt`)
      return { ...EMPTY_RESULT, skippedReason: 'ai_disabled' }
    }

    const company = await this.loadCompanyForReading(companyId)
    const snapshot = this.snapshots.read(companyId, variant)

    if (!snapshot) {
      return this.recordUnreadableSource(companyId)
    }

    const rawContent = normalizeSnapshotText(snapshot.rawHtml)
    const contentHash = hashSnapshotContent(rawContent)

    const latest = await this.latestObservationForUrl(companyId, snapshot.sourceUrl)
    if (latest?.contentHash === contentHash) {
      this.logger.log(`Đã đọc, không đổi: công ty ${companyId} — không tạo bản lưu, không gọi LLM`)
      return { ...EMPTY_RESULT, unchanged: true }
    }

    const [created] = await this.dbSystem
      .insert(observations)
      .values({
        companyId,
        sourceUrl: snapshot.sourceUrl,
        rawHtml: snapshot.rawHtml,
        rawContent,
        contentHash,
        extractorVersion: EXTRACTOR_VERSION,
        fetchStatus: 'ok',
      })
      .returning()

    const drafts = await this.extractor.extract({
      id: created.id,
      companyId,
      rawContent,
      // ontology section 4: a finding is read under the lens of the company type.
      companyType: company.companyType,
      triggerContext,
      currentProfile: {
        industry: company.industry,
        country: company.country,
        size: company.size,
        website: company.website,
      },
    })

    const result = await this.claims.saveDrafts(
      created.id,
      companyId,
      rawContent,
      triggerContext,
      drafts,
    )

    this.logger.log(
      `Bản lưu ${created.id}: ${result.saved.length}/${result.proposed} phát hiện được lưu, ` +
        `${result.droppedNoVerbatimQuote} bỏ vì câu trích không khớp, ` +
        `${result.downgradedFromCertain} hạ mức Chắc`,
    )

    /**
     * The ONE line that hands findings on to the rest of the product (ADR-0023). Everything
     * downstream — group 4 setting a next step, group 3 filing suggestions, group 5 adding its
     * own timeline entry — hangs off `ClaimReactionService`, so this file does not grow a branch
     * per feature group and the ORDER between them stays written down in one place (group 4
     * first: it decides whether I-7 turns a next step into a suggestion instead of a write).
     *
     * `capturedAt` comes from the `.returning()` above, so group 5 dates its entry from the
     * snapshot at no extra query. Reading it back would cost a round trip AND invite the
     * `timestamptz` rounding trap of feature group 4.
     */
    const reaction = await this.reactions.react({
      companyId,
      observationId: created.id,
      savedClaims: result.saved,
      observationCapturedAt: created.capturedAt,
      /**
       * Hard-coded, and only for as long as this method reads through `DemoSnapshotSource`.
       * `resolveObservationSource` (I-16/I-17) is what decides this value, and it is wired in
       * together with `LiveCrawlSource` — resolving to `live_crawl` before a crawler exists would
       * label snapshot content as a live read, which is a lie in the one column the autonomy
       * ceiling is computed from.
       */
      sourceKind: 'demo_snapshot',
    })

    return {
      observationId: created.id,
      unchanged: false,
      skippedReason: null,
      fetchStatus: 'ok',
      claimsProposed: result.proposed,
      claimsSaved: result.saved.length,
      claimsDroppedNoVerbatimQuote: result.droppedNoVerbatimQuote,
      claimsDowngradedFromCertain: result.downgradedFromCertain,
      systemEntriesAdded: reaction.systemEntriesAdded,
    }
  }

  /** The read zone: snapshots newest first, each with the findings drawn from it. */
  async readingZone(companyId: string): Promise<ObservationWithClaimsDto[]> {
    const rows = await this.dbApp
      .select()
      .from(observations)
      .where(eq(observations.companyId, companyId))
      .orderBy(desc(observations.capturedAt))

    return Promise.all(
      rows.map(async (row) => ({
        ...toDto(row),
        claims: await this.claims.listForObservation(row.id),
      })),
    )
  }

  /**
   * ontology 3.5 — an unreadable source is recorded as `failed`, never guessed. So a row IS
   * written (the attempt is a fact worth keeping) with empty content and no findings at all.
   *
   * I-3 deliberately does NOT apply to this path. I-3 exists to stop timeline spam and LLM
   * cost, and a failed read causes neither; treating a second failure as "đã đọc, không đổi"
   * would hide an ongoing outage behind a reassuring log line.
   */
  private async recordUnreadableSource(companyId: string): Promise<IngestResultDto> {
    const sourceUrl = this.snapshots.sourceUrlFor(companyId) ?? 'unknown'
    const [created] = await this.dbSystem
      .insert(observations)
      .values({
        companyId,
        sourceUrl,
        rawHtml: null,
        rawContent: '',
        contentHash: hashSnapshotContent(''),
        extractorVersion: EXTRACTOR_VERSION,
        fetchStatus: 'failed',
      })
      .returning()

    this.logger.warn(`Không đọc được nguồn của công ty ${companyId} — ghi fetch_status=failed`)

    return {
      observationId: created.id,
      unchanged: false,
      skippedReason: null,
      fetchStatus: 'failed',
      claimsProposed: 0,
      claimsSaved: 0,
      claimsDroppedNoVerbatimQuote: 0,
      claimsDowngradedFromCertain: 0,
      systemEntriesAdded: 0,
    }
  }

  /**
   * I-3, scoped to ONE URL (ADR-0036).
   *
   * It used to compare against the latest observation of the COMPANY, which is the same thing
   * while every company has exactly one source — every snapshot company does. Add a second URL
   * and the two readings cross-check: URL A's hash is compared against URL B's row, never
   * matches, so every read stores a new row for every URL and pays for an LLM call on each. The
   * invariant reads "different from the most recent snapshot", and with several sources the most
   * recent snapshot is per source.
   *
   * Still enforced here rather than by a UNIQUE index, unchanged from ADR-0017: a global unique
   * also rejects the before → after → before sequence a judge produces when replaying T-6/T-8 a
   * second time.
   */
  private async latestObservationForUrl(companyId: string, sourceUrl: string) {
    const [latest] = await this.dbSystem
      .select({ contentHash: observations.contentHash })
      .from(observations)
      .where(and(eq(observations.companyId, companyId), eq(observations.sourceUrl, sourceUrl)))
      .orderBy(desc(observations.capturedAt))
      .limit(1)

    return latest
  }

  /** Read under the AI identity: `crm_system` holds SELECT on `companies` and nothing more. */
  private async loadCompanyForReading(companyId: string) {
    const [company] = await this.dbSystem
      .select({
        id: companies.id,
        companyType: companies.companyType,
        /**
         * The four proposable fields, handed to the extractor so it only suggests a cell that
         * is blank or stale (ADR-0024). SELECT only — `crm_system` cannot write any of them,
         * which is what makes group 3 a queue rather than an edit.
         */
        industry: companies.industry,
        country: companies.country,
        size: companies.size,
        website: companies.website,
      })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1)

    if (!company) throw new NotFoundException('Không tìm thấy công ty')
    return company
  }
}

function toDto(row: typeof observations.$inferSelect): ObservationDto {
  return {
    id: row.id,
    companyId: row.companyId,
    sourceUrl: row.sourceUrl,
    sourceTier: row.sourceTier,
    capturedAt: row.capturedAt.toISOString(),
    rawContent: row.rawContent,
    rawHtml: row.rawHtml,
    fetchStatus: row.fetchStatus as FetchStatus,
  }
}
