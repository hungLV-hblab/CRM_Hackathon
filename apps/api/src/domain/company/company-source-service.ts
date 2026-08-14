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
  MAX_SOURCES_PER_COMPANY,
  SOURCE_DISCOVERY,
  type CompanySourceDto,
  type SourceCandidate,
  type SourceDiscovery,
} from '@crm/contracts'
import { type CrmDatabase, companies, companySources } from '@crm/db'

import { AuditEventService } from '../../common/audit/audit-event-service'
import { DRIZZLE_APP } from '../../common/db/db.module'
import { SystemSettingService } from '../../settings/system-setting-service'
import { isSeedCompany } from '../../ai/resolve-observation-source'
import type { Actor } from '../../common/actor/actor-context'

/**
 * The reading list of a company, and the two-step that keeps it human-owned (ADR-0036).
 *
 *   findCandidates  → runs the search, RETURNS candidates, writes nothing
 *   save            → a person ticked some; only this writes, under `crm_app`, with `added_by`
 *
 * Splitting these is the whole design. "Search and save what you find" would be a third path on
 * which the AI writes to official data, outside the two exceptions Specs opens (CLAUDE.md
 * section 4) — and worse than the other two, because a model that picks its own reading list is
 * choosing which evidence it will then report on. `crm_system` holds SELECT and nothing else on
 * this table (`0008_live_source.sql`), so the database refuses it too; this class is why the
 * product never has to ask.
 *
 * The cost of the split is that a page refresh loses the candidate list. That is accepted: the
 * search takes 10–20 seconds once per company, and the alternative costs the guarantee.
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

  /** Runs the search. Persists NOTHING — `company-source-candidates.test.ts` test 1 pins that. */
  async findCandidates(actor: Actor, companyId: string): Promise<SourceCandidate[]> {
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

    /**
     * The measurement the plan asks for: how many were offered versus how many a person keeps.
     * Logged rather than stored — one round of usage is enough to tell whether the search is
     * finding real sources for small B2B companies, which is the open question of this phase.
     */
    this.logger.log(`Tìm nguồn công ty ${companyId}: ${candidates.length} ứng viên trả về`)
    return candidates
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
  }
}

/** Postgres unique-violation SQLSTATE, read off whatever the driver wrapped the error in. */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}
