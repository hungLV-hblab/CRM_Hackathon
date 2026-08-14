import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { and, asc, eq } from 'drizzle-orm'

import {
  MAX_CANDIDATES_PER_COMPANY,
  MAX_SOURCES_PER_COMPANY,
  SOURCE_DISCOVERY,
  type CompanySourceCandidateDto,
  type CompanySourceDto,
  type SourceDiscovery,
} from '@crm/contracts'
import { type CrmDatabase, companies, companySourceCandidates, companySources } from '@crm/db'

import { AuditEventService } from '../../common/audit/audit-event-service'
import { DRIZZLE_APP } from '../../common/db/db.module'
import { SystemSettingService } from '../../settings/system-setting-service'
import { isSeedCompany } from '../../ai/resolve-observation-source'
import type { Actor } from '../../common/actor/actor-context'

/**
 * TWO LISTS, and telling them apart is the whole design (ADR-0036, ADR-0037).
 *
 *   company_source_candidates — what a search OFFERED. `findCandidates` writes here.
 *   company_sources           — what a person KEPT. Only `save` writes here.
 *
 *   findCandidates  → runs the search, stores the suggestions, touches the reading list NEVER
 *   listCandidates  → the stored suggestions, each marked with whether it is already kept
 *   save            → a person ticked some; only this writes the reading list, with `added_by`
 *   setEnabled      → pause or resume one kept page without losing why it was chosen
 *
 * "Search and save what you find" would be a third path on which the AI writes to official data,
 * outside the two exceptions Specs opens (CLAUDE.md section 4) — and worse than the other two,
 * because a model that picks its own reading list is choosing which evidence it will then report
 * on. The database refuses it as well: `crm_system` holds SELECT on nothing but
 * `company_sources_enabled`, and on the suggestion table it holds no privilege at all.
 *
 * Storing the suggestions does NOT weaken that. It cost 10–20 seconds and a paid search to lose
 * them on every refresh, and they now survive in a table the AI identity cannot read, cannot write,
 * and does not act on. The human click is still the only thing that puts a URL where the crawler
 * will see it.
 */
@Injectable()
export class CompanySourceService {
  private readonly logger = new Logger('CompanySourceService')

  constructor(
    @Inject(DRIZZLE_APP) private readonly db: CrmDatabase,
    @Inject(SOURCE_DISCOVERY) private readonly discovery: SourceDiscovery,
    private readonly settings: SystemSettingService,
    private readonly audit: AuditEventService,
  ) {}

  /**
   * Runs the search and stores what it offered. Never touches the reading list —
   * `company-source-candidates.test.ts` test 1 counts `company_sources` at zero afterwards, and
   * that assertion did not change when candidates started being stored.
   */
  async findCandidates(actor: Actor, companyId: string): Promise<CompanySourceCandidateDto[]> {
    /**
     * The AI identity is refused before anything else happens — before the kill switch is even
     * read, because a wrong actor makes the rest of the question irrelevant.
     *
     * Why refuse a route that only writes SUGGESTIONS: a suggestion list the machine filled by
     * itself is a nudge, and an absolute boundary has to hold when the command does not come from
     * the UI (T-10). The two-step means nothing if the machine can take the first step alone.
     */
    if (actor.kind === 'system') {
      await this.audit.recordRefusal(actor, 'save_source_candidates', 'company', companyId, {
        reason:
          'a suggestion list the machine filled for itself is a nudge toward sources it chose; ' +
          'a person presses the search button (ADR-0037)',
      })
      throw new ForbiddenException('Hệ thống không được tự tìm nguồn')
    }

    /**
     * ADR-0009 — the kill switch stops every generation path, and asking a model to search the
     * web is one of them. Quiet and empty rather than an exception: the switch being off is a
     * state the product is in, not an error the user made.
     */
    const parameters = await this.settings.read()
    if (!parameters.aiEnabled) {
      this.logger.log(`Bỏ qua tìm nguồn cho công ty ${companyId}: AI đang tắt`)
      return []
    }

    const company = await this.loadCompany(companyId)

    /**
     * I-16 covers the whole live path, not only the fetch. A seed company can never be crawled,
     * so a search for one would spend money to build a list nothing is allowed to read.
     */
    if (isSeedCompany(companyId)) {
      await this.audit.recordRefusal(actor, 'discover_company_sources', 'company', companyId, {
        reason:
          'a seed company reads the stored snapshot only (I-16), so searching for live sources ' +
          'would produce a list nothing may read',
      })
      throw new ForbiddenException(
        'Công ty thuộc bộ dữ liệu nghiệm thu chỉ đọc bản chụp — không tìm nguồn web thật',
      )
    }

    const candidates = await this.discovery.discover({
      companyName: company.name,
      companyWebsite: company.website,
      companyType: company.companyType,
    })

    this.logger.log(`Tìm nguồn công ty ${companyId}: ${candidates.length} ứng viên trả về`)

    /**
     * REPLACE, not accumulate (ADR-0037 mục c): the stored list means "the result of the latest
     * search". Accumulating would need a hard cap and a way to clean up, and would leave candidates
     * somebody has already skipped three times sitting in the way.
     *
     * One transaction so there is no moment where the list is empty because the insert failed. And
     * the search finished BEFORE this block on purpose — a search that throws can never be the
     * reason somebody's list disappeared.
     */
    await this.db.transaction(async (tx) => {
      await tx
        .delete(companySourceCandidates)
        .where(eq(companySourceCandidates.companyId, companyId))

      if (candidates.length === 0) return

      await tx
        .insert(companySourceCandidates)
        .values(
          // Cut here rather than in a zod schema: this is a machine result being bounded, not user
          // input being validated. Seven good pages should keep six, not be refused.
          candidates.slice(0, MAX_CANDIDATES_PER_COMPANY).map((candidate) => ({
            companyId,
            url: candidate.url,
            sourceTier: candidate.sourceTier,
            reason: candidate.reason,
            snippet: candidate.snippet || null,
            foundBy: actor.userId,
          })),
        )
    })

    /**
     * Freshly replaced, so nothing here can be in the reading list yet unless the same URL was kept
     * from an earlier search — which `listCandidates` resolves by joining on the URL rather than by
     * guessing. Going through it keeps one answer to "is this candidate already kept".
     */
    return this.listCandidates(companyId)
  }

  /**
   * The stored suggestions, each one carrying whether the reading list already contains its URL.
   *
   * Does NOT throw for a seed company. I-16 refuses the SEARCH there, so this list is permanently
   * empty — and "nothing found" is a different answer from "you may not look". A screen that cannot
   * open at all teaches a reader neither.
   */
  async listCandidates(companyId: string): Promise<CompanySourceCandidateDto[]> {
    /**
     * `savedSourceId` is DERIVED by joining on `(company_id, url)` — there is no "selected" column
     * anywhere. One source of truth for "which pages do we read" means no second flag able to drift
     * out of step with the list that actually gets fetched.
     */
    const rows = await this.db
      .select({
        candidate: companySourceCandidates,
        savedSourceId: companySources.id,
      })
      .from(companySourceCandidates)
      .leftJoin(
        companySources,
        and(
          eq(companySources.companyId, companySourceCandidates.companyId),
          eq(companySources.url, companySourceCandidates.url),
        ),
      )
      .where(eq(companySourceCandidates.companyId, companyId))
      .orderBy(asc(companySourceCandidates.foundAt), asc(companySourceCandidates.url))

    return rows.map((row) => toCandidateDto(row.candidate, row.savedSourceId))
  }

  /** Drop one suggestion. The reading list is untouched even if the same URL was kept. */
  async removeCandidate(actor: Actor, companyId: string, candidateId: string): Promise<void> {
    if (actor.kind === 'system') {
      await this.audit.recordRefusal(actor, 'remove_source_candidate', 'company', companyId, {
        reason: 'the suggestion list belongs to the person reading it; the AI does not curate it',
      })
      throw new ForbiddenException('Hệ thống không được tự xoá ứng viên nguồn')
    }

    const [removed] = await this.db
      .delete(companySourceCandidates)
      .where(
        and(
          eq(companySourceCandidates.id, candidateId),
          eq(companySourceCandidates.companyId, companyId),
        ),
      )
      .returning()

    if (!removed) throw new NotFoundException('Không tìm thấy ứng viên cần xoá')

    await this.audit.record(actor, 'remove_source_candidate', 'company', companyId, {
      outcome: 'accepted',
      url: removed.url,
    })
  }

  /**
   * Pause or resume reading one kept page.
   *
   * A switch rather than a delete, because the row carries the snippet that made somebody pick this
   * page: removing it to stop reading for a week throws away the answer to "why was this here".
   *
   * Refused for the AI identity like every other write. Switching a source OFF sounds harmless —
   * the AI choosing to read less — but it is still the AI deciding what evidence it sees.
   */
  async setEnabled(
    actor: Actor,
    companyId: string,
    sourceId: string,
    enabled: boolean,
  ): Promise<CompanySourceDto> {
    if (actor.kind === 'system') {
      await this.audit.recordRefusal(actor, 'toggle_company_source', 'company', companyId, {
        reason:
          'switching a source off is still the AI deciding which evidence it sees; the reading ' +
          'list is human-owned in both directions',
      })
      throw new ForbiddenException('Hệ thống không được tự bật/tắt nguồn đọc')
    }

    const [updated] = await this.db
      .update(companySources)
      .set({ enabled })
      .where(and(eq(companySources.id, sourceId), eq(companySources.companyId, companyId)))
      .returning()

    if (!updated) throw new NotFoundException('Không tìm thấy nguồn cần bật/tắt')

    await this.audit.record(actor, 'toggle_company_source', 'company', companyId, {
      outcome: 'accepted',
      url: updated.url,
      enabled,
    })

    return toDto(updated)
  }

  /** The click that writes. Under `crm_app`, with the person recorded on the row. */
  async save(
    actor: Actor,
    companyId: string,
    sources: { url: string; sourceTier: string; searchSnippet?: string }[],
  ): Promise<CompanySourceDto[]> {
    if (actor.kind === 'system') {
      await this.audit.recordRefusal(actor, 'save_company_sources', 'company', companyId, {
        reason: 'the AI may not choose which sources it reads (ADR-0036); a human keeps the list',
      })
      throw new ForbiddenException('Hệ thống không được tự lưu nguồn đọc')
    }

    await this.loadCompany(companyId)

    const existing = await this.list(companyId)
    if (existing.length + sources.length > MAX_SOURCES_PER_COMPANY) {
      /**
       * Counted against what is ALREADY saved, not against this request alone. Every stored URL
       * costs one fetch and one LLM call on every read, so the cap has to bound the list rather
       * than the batch.
       */
      throw new BadRequestException(
        `Mỗi công ty giữ tối đa ${MAX_SOURCES_PER_COMPANY} nguồn — hiện có ${existing.length}, đang thêm ${sources.length}`,
      )
    }

    try {
      const rows = await this.db
        .insert(companySources)
        .values(
          sources.map((source) => ({
            companyId,
            url: source.url,
            sourceTier: source.sourceTier,
            discoveredVia: 'web_search',
            searchSnippet: source.searchSnippet ?? null,
            addedBy: actor.userId,
          })),
        )
        .returning()

      await this.audit.record(actor, 'save_company_sources', 'company', companyId, {
        outcome: 'accepted',
        urls: sources.map((source) => source.url),
      })

      return rows.map(toDto)
    } catch (error) {
      /**
       * The UNIQUE on `(company_id, url)` is the only thing that can reject here, and it is worth
       * naming: "already in the list" is a fact about the list, and a raw constraint message
       * names neither the company nor the URL (ADR-0010).
       */
      if (isUniqueViolation(error)) {
        throw new ConflictException('Nguồn này đã có trong danh sách của công ty')
      }
      throw error
    }
  }

  async list(companyId: string): Promise<CompanySourceDto[]> {
    const rows = await this.db
      .select()
      .from(companySources)
      .where(eq(companySources.companyId, companyId))
      .orderBy(asc(companySources.createdAt))

    return rows.map(toDto)
  }

  async remove(actor: Actor, companyId: string, sourceId: string): Promise<void> {
    if (actor.kind === 'system') {
      await this.audit.recordRefusal(actor, 'remove_company_source', 'company', companyId, {
        reason: 'the reading list is human-owned; the AI neither adds nor removes entries',
      })
      throw new ForbiddenException('Hệ thống không được tự xoá nguồn đọc')
    }

    const [removed] = await this.db
      .delete(companySources)
      .where(and(eq(companySources.id, sourceId), eq(companySources.companyId, companyId)))
      .returning()

    if (!removed) throw new NotFoundException('Không tìm thấy nguồn cần xoá')

    await this.audit.record(actor, 'remove_company_source', 'company', companyId, {
      outcome: 'accepted',
      url: removed.url,
    })
  }

  private async loadCompany(companyId: string) {
    const [company] = await this.db
      .select({
        id: companies.id,
        name: companies.name,
        website: companies.website,
        companyType: companies.companyType,
      })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1)

    if (!company) throw new NotFoundException('Không tìm thấy công ty')
    return company
  }
}

function toDto(row: typeof companySources.$inferSelect): CompanySourceDto {
  return {
    id: row.id,
    companyId: row.companyId,
    url: row.url,
    sourceTier: row.sourceTier,
    discoveredVia: row.discoveredVia,
    searchSnippet: row.searchSnippet,
    addedBy: row.addedBy,
    createdAt: row.createdAt.toISOString(),
    enabled: row.enabled,
  }
}

function toCandidateDto(
  row: typeof companySourceCandidates.$inferSelect,
  savedSourceId: string | null,
): CompanySourceCandidateDto {
  return {
    id: row.id,
    companyId: row.companyId,
    url: row.url,
    sourceTier: row.sourceTier,
    reason: row.reason,
    snippet: row.snippet,
    foundAt: row.foundAt.toISOString(),
    foundBy: row.foundBy,
    savedSourceId,
  }
}

/** Postgres unique-violation SQLSTATE, read off whatever the driver wrapped the error in. */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}
