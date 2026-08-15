import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { and, asc, desc, eq } from 'drizzle-orm'

import {
  CLAIM_EXTRACTOR,
  type ClaimExtractor,
  type FetchErrorReason,
  type FetchStatus,
  type IngestResultDto,
  type ObservationDto,
  type ObservationWithClaimsDto,
  type SourceKind,
  type SourceTier,
  type TriggerContext,
} from '@crm/contracts'
import { type CrmDatabase, companies, companySourcesEnabled, observations } from '@crm/db'

import { ClaimReactionService } from '../claim/claim-reaction-service'
import { ClaimService } from '../claim/claim-service'
import { DRIZZLE_APP, DRIZZLE_SYSTEM } from '../../common/db/db.module'
import { DemoSnapshotSource, type SnapshotVariant } from '../../ai/demo-snapshots'
import { LiveCrawlSource } from '../../ai/live-crawl-source'
import { SystemSettingService } from '../../settings/system-setting-service'
import { resolveObservationSource } from '../../ai/resolve-observation-source'
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
  sourcesAttempted: 0,
  sourcesFailed: 0,
}

/**
 * One attempt at one source, already reduced to what a row needs. Both source kinds produce this
 * shape, which is what keeps the write path below single: the difference between reading a stored
 * page and fetching a live one ends at `collectReads`, and everything after it is identical.
 */
interface SourceRead {
  sourceUrl: string
  sourceTier: SourceTier
  /** `null` means the source could not be read. Never an empty string standing in for failure. */
  rawHtml: string | null
  /**
   * Only ever set on the live path. A stored snapshot that cannot be read has no diagnosis to
   * offer — inventing one would be a wrong line where a blank is honest (rule 4).
   */
  fetchErrorReason: FetchErrorReason | null
}

/** What one source contributed, before the sources are added up. */
interface SourceOutcome {
  observationId: string | null
  unchanged: boolean
  failed: boolean
  claimsProposed: number
  claimsSaved: number
  claimsDroppedNoVerbatimQuote: number
  claimsDowngradedFromCertain: number
  systemEntriesAdded: number
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
    private readonly live: LiveCrawlSource,
  ) {}

  /**
   * Read a company's sources once — one `Observation` per source.
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

    /**
     * I-16 and I-17, on the execution path rather than only in a unit test. Phase 1 deliberately
     * hard-coded `demo_snapshot` here: resolving to `live_crawl` before a crawler existed would
     * have labelled stored snapshot content as a live read, which is a lie in the one column the
     * autonomy ceiling is computed from. The crawler exists now, so the decision moves in.
     */
    const decision = resolveObservationSource({
      aiEnabled: parameters.aiEnabled,
      configuredSource: process.env.OBSERVATION_SOURCE,
      companyId,
      liveSourceEnabled: company.liveSourceEnabled,
    })

    if (decision === 'disabled') {
      this.logger.log(`Bỏ qua đọc nguồn công ty ${companyId}: AI đang tắt`)
      return { ...EMPTY_RESULT, skippedReason: 'ai_disabled' }
    }

    const reads = await this.collectReads(company, variant, decision)

    /**
     * One source per iteration, and a failure inside one does NOT abandon the rest. Same reasoning
     * as the try/catch in `claim-reaction-service.ts:96-108`: a company whose news page is down
     * still has a press page worth reading, and dropping it would make one bad source silently
     * cost the others.
     */
    const outcomes: SourceOutcome[] = []
    for (const read of reads) {
      outcomes.push(await this.ingestOne(company, read, decision, triggerContext))
    }

    return summarise(outcomes)
  }

  /**
   * WHERE to read, and the only place the two source kinds differ.
   *
   * `demo_snapshot` reads every page `snapshot_pages` has for this company (up to N —
   * generalised from a single page/company, see `demo-snapshots.ts`). The loop over the
   * result below (`for (const read of reads)`) already handled N sources before this change,
   * built for the `company_sources`/live-crawl path — no other code in this method changes.
   */
  private async collectReads(
    company: CompanyForReading,
    variant: SnapshotVariant,
    decision: 'demo_snapshot' | 'live_crawl',
  ): Promise<SourceRead[]> {
    if (decision === 'demo_snapshot') {
      const snapshots = await this.snapshots.readAll(company.id, variant)
      if (snapshots.length === 0) {
        return [
          {
            sourceUrl: (await this.snapshots.sourceUrlFor(company.id)) ?? 'unknown',
            sourceTier: 'company_website',
            rawHtml: null,
            fetchErrorReason: null,
          },
        ]
      }
      return snapshots.map((snapshot) => ({
        sourceUrl: snapshot.sourceUrl,
        sourceTier: 'company_website' as const,
        rawHtml: snapshot.rawHtml,
        fetchErrorReason: null,
      }))
    }

    const reads: SourceRead[] = []
    for (const source of await this.liveSourceUrls(company)) {
      const result = await this.live.read(source.url)
      reads.push(
        result.ok
          ? {
              sourceUrl: result.sourceUrl,
              sourceTier: source.sourceTier,
              rawHtml: result.rawHtml,
              fetchErrorReason: null,
            }
          : {
              sourceUrl: result.sourceUrl,
              sourceTier: source.sourceTier,
              rawHtml: null,
              fetchErrorReason: result.reason,
            },
      )
    }
    return reads
  }

  /**
   * WHICH pages to read, in precedence order (decision V4).
   *
   *   1. `company_sources_enabled` — the pages a person ticked and has left switched ON. Always
   *      wins when it has entries.
   *   2. `companies.website` — the address Sales typed when they created the company.
   *
   * Two sources of truth for one question is a cost, taken deliberately: the fall-back is what
   * lets someone switch a company on and press read without first being made to run a source
   * search, and it is what keeps every phase-2 test meaningful. The price is that the precedence
   * has to be pinned by a test rather than by there being only one answer — see
   * `multi-source-ingest.test.ts` tests 4 to 6.
   *
   * An empty `website` is NOT skipped. It comes back as one failed read carrying `invalid_url`,
   * because "this company has no address on file" is a fact worth showing, and a silent empty
   * list would leave the screen looking as though nothing had been asked for.
   *
   * Read under `DRIZZLE_SYSTEM`, and that is the point rather than an accident: `crm_system` writes
   * nothing anywhere near this list, so the identity that reads it provably cannot have written it.
   *
   * THE VIEW IS NOT A CONVENIENCE, AND THERE IS NO `WHERE enabled` BELOW ON PURPOSE (ADR-0037).
   * `crm_system` has no SELECT on `company_sources` itself (`0011_source_enabled_view.sql`), so
   * "never fetch a page somebody switched off" is not a filter this method has to remember — it is
   * the only thing the role is allowed to see. Point this query at the table instead and it fails
   * with `permission denied` rather than quietly reading a switched-off URL. Measured by
   * `disabled-source-not-read.test.ts`.
   */
  private async liveSourceUrls(
    company: CompanyForReading,
  ): Promise<{ url: string | null; sourceTier: SourceTier }[]> {
    const saved = await this.dbSystem
      .select({ url: companySourcesEnabled.url, sourceTier: companySourcesEnabled.sourceTier })
      .from(companySourcesEnabled)
      .where(eq(companySourcesEnabled.companyId, company.id))
      .orderBy(asc(companySourcesEnabled.createdAt))

    if (saved.length > 0) {
      return saved.map((source) => ({
        url: source.url,
        sourceTier: source.sourceTier as SourceTier,
      }))
    }

    return [{ url: company.website, sourceTier: 'company_website' }]
  }

  /** One source → at most one row, its findings, and whatever those findings were allowed to do. */
  private async ingestOne(
    company: CompanyForReading,
    read: SourceRead,
    sourceKind: SourceKind,
    triggerContext: TriggerContext,
  ): Promise<SourceOutcome> {
    if (read.rawHtml === null) {
      return this.recordUnreadableSource(company.id, read, sourceKind)
    }

    const rawContent = normalizeSnapshotText(read.rawHtml)
    const contentHash = hashSnapshotContent(rawContent)

    const latest = await this.latestObservationForUrl(company.id, read.sourceUrl)
    if (latest?.contentHash === contentHash) {
      this.logger.log(
        `Đã đọc, không đổi: ${read.sourceUrl} — không tạo bản lưu, không gọi LLM`,
      )
      return { ...EMPTY_OUTCOME, unchanged: true }
    }

    const [created] = await this.dbSystem
      .insert(observations)
      .values({
        companyId: company.id,
        sourceUrl: read.sourceUrl,
        sourceTier: read.sourceTier,
        rawHtml: read.rawHtml,
        rawContent,
        contentHash,
        extractorVersion: EXTRACTOR_VERSION,
        fetchStatus: 'ok',
        sourceKind,
      })
      .returning()

    const drafts = await this.extractor.extract({
      id: created.id,
      companyId: company.id,
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
      company.id,
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
      companyId: company.id,
      observationId: created.id,
      savedClaims: result.saved,
      observationCapturedAt: created.capturedAt,
      /**
       * I-15. Now the real answer rather than a constant: findings drawn from a page nobody on
       * the team has read may only ever become a `Proposal`, however watched the company is.
       */
      sourceKind,
    })

    return {
      observationId: created.id,
      unchanged: false,
      failed: false,
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
  private async recordUnreadableSource(
    companyId: string,
    read: SourceRead,
    sourceKind: SourceKind,
  ): Promise<SourceOutcome> {
    const [created] = await this.dbSystem
      .insert(observations)
      .values({
        companyId,
        sourceUrl: read.sourceUrl,
        sourceTier: read.sourceTier,
        rawHtml: null,
        rawContent: '',
        contentHash: hashSnapshotContent(''),
        extractorVersion: EXTRACTOR_VERSION,
        fetchStatus: 'failed',
        sourceKind,
        fetchErrorReason: read.fetchErrorReason,
      })
      .returning()

    this.logger.warn(
      `Không đọc được ${read.sourceUrl} của công ty ${companyId} — ghi fetch_status=failed` +
        (read.fetchErrorReason ? ` (${read.fetchErrorReason})` : ''),
    )

    return { ...EMPTY_OUTCOME, observationId: created.id, failed: true }
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
  private async loadCompanyForReading(companyId: string): Promise<CompanyForReading> {
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
        /**
         * SELECT and never UPDATE, by grant (0001). That is the whole reason this switch can be
         * trusted: the AI reads whether it may crawl and has no way to answer yes for itself.
         */
        liveSourceEnabled: companies.liveSourceEnabled,
      })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1)

    if (!company) throw new NotFoundException('Không tìm thấy công ty')
    return company
  }
}

type CompanyForReading = {
  id: string
  companyType: string
  industry: string | null
  country: string | null
  size: string | null
  website: string | null
  liveSourceEnabled: boolean
}

const EMPTY_OUTCOME: SourceOutcome = {
  observationId: null,
  unchanged: false,
  failed: false,
  claimsProposed: 0,
  claimsSaved: 0,
  claimsDroppedNoVerbatimQuote: 0,
  claimsDowngradedFromCertain: 0,
  systemEntriesAdded: 0,
}

/**
 * Several sources collapsed into the one result the API has always returned.
 *
 * With a single source — every read before phase 2, and every snapshot read after it — this is
 * the identity function, which is what lets the live path arrive without rewriting the screen or
 * a single existing test. `sourcesAttempted` / `sourcesFailed` are what carry the part that no
 * longer fits: "two of your three sources answered" is not expressible in a single `fetchStatus`.
 */
function summarise(outcomes: SourceOutcome[]): IngestResultDto {
  const failed = outcomes.filter((outcome) => outcome.failed).length

  return {
    /** The first row this read created — null when every source was unchanged. */
    observationId: outcomes.find((outcome) => outcome.observationId)?.observationId ?? null,
    /** Only when NOTHING moved anywhere: one changed source makes the whole read a change. */
    unchanged: outcomes.length > 0 && outcomes.every((outcome) => outcome.unchanged),
    skippedReason: null,
    /** `failed` only when no source at all could be read; one page answering is still an answer. */
    fetchStatus: outcomes.length > 0 && failed === outcomes.length ? 'failed' : 'ok',
    claimsProposed: sum(outcomes, (outcome) => outcome.claimsProposed),
    claimsSaved: sum(outcomes, (outcome) => outcome.claimsSaved),
    claimsDroppedNoVerbatimQuote: sum(outcomes, (o) => o.claimsDroppedNoVerbatimQuote),
    claimsDowngradedFromCertain: sum(outcomes, (o) => o.claimsDowngradedFromCertain),
    systemEntriesAdded: sum(outcomes, (outcome) => outcome.systemEntriesAdded),
    sourcesAttempted: outcomes.length,
    sourcesFailed: failed,
  }
}

function sum(outcomes: SourceOutcome[], pick: (outcome: SourceOutcome) => number): number {
  return outcomes.reduce((total, outcome) => total + pick(outcome), 0)
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
    sourceKind: row.sourceKind as SourceKind,
    fetchErrorReason: row.fetchErrorReason as FetchErrorReason | null,
  }
}
