import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, asc, eq, ilike, isNull } from 'drizzle-orm'

import type {
  CompanyDto,
  CompanyType,
  CreateCompanyDto,
  ListCompaniesQuery,
  UpdateCompanyDto,
} from '@crm/contracts'
import { type CrmDatabase, companies } from '@crm/db'

import { DRIZZLE_APP } from '../../common/db/db.module'
import { AuditEventService } from '../../common/audit/audit-event-service'
import { isSeedCompany } from '../../ai/resolve-observation-source'
import type { Actor } from '../../common/actor/actor-context'

/**
 * Sales' official data (ontology 3.1, feature group 1) → injects `DRIZZLE_APP` ONLY.
 * No branch here runs under the system identity, so the system pool is absent: better to
 * lack it than to have it sitting around waiting to be used by mistake.
 */
@Injectable()
export class CompanyService {
  constructor(
    @Inject(DRIZZLE_APP) private readonly db: CrmDatabase,
    private readonly audit: AuditEventService,
  ) {}

  async create(actor: Actor, dto: CreateCompanyDto): Promise<CompanyDto> {
    if (actor.kind === 'system') {
      await this.audit.recordRefusal(actor, 'create_company', 'company', null, {
        reason: 'companies are human-created; the AI may only propose field edits (I-11)',
      })
      throw new ForbiddenException('Hệ thống không được tạo công ty')
    }

    const [created] = await this.db
      .insert(companies)
      .values({ ...dto, ownerId: actor.userId })
      .returning()

    return toDto(created)
  }

  /**
   * Search by name plus the four filters, combinable. Everything is optional and an absent
   * filter widens rather than narrows — a screen that starts empty until you pick something
   * hides the data it exists to show.
   */
  async list(query: ListCompaniesQuery = {}): Promise<CompanyDto[]> {
    const conditions = [isNull(companies.deletedAt)]
    // `ilike` with wrapping wildcards: Sales types a fragment of the name, not a prefix, and
    // the Vietnamese name they remember is rarely the one at the start of the legal name.
    if (query.q) conditions.push(ilike(companies.name, `%${query.q}%`))
    if (query.industry) conditions.push(eq(companies.industry, query.industry))
    if (query.companyType) {
      conditions.push(eq(companies.companyType, query.companyType as CompanyType))
    }
    if (query.country) conditions.push(eq(companies.country, query.country))
    if (query.isWatched !== undefined) conditions.push(eq(companies.isWatched, query.isWatched))

    const rows = await this.db
      .select()
      .from(companies)
      .where(and(...conditions))
      .orderBy(asc(companies.name))

    return rows.map(toDto)
  }

  async byId(companyId: string): Promise<CompanyDto> {
    const [row] = await this.db
      .select()
      .from(companies)
      .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))

    if (!row) throw new NotFoundException('Không tìm thấy công ty')
    return toDto(row)
  }

  /**
   * Every profile cell, `companyType` included. I-11 forbids a `Proposal` from editing the
   * lens signals are read under; that is a constraint on the AI, not on the person who typed
   * the value in the first place and now needs to fix a typo.
   */
  async update(actor: Actor, companyId: string, dto: UpdateCompanyDto): Promise<CompanyDto> {
    if (actor.kind === 'system') {
      await this.audit.recordRefusal(actor, 'update_company', 'company', companyId, {
        reason: 'the AI edits a company field through the review queue, never directly (I-11)',
      })
      throw new ForbiddenException('Hệ thống không được sửa hồ sơ công ty trực tiếp')
    }

    const [updated] = await this.db
      .update(companies)
      .set({ ...dto, updatedAt: new Date() })
      .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
      .returning()

    if (!updated) throw new NotFoundException('Không tìm thấy công ty')
    return toDto(updated)
  }

  /**
   * The per-company gate on the live web source (ADR-0035 · I-16 · I-17).
   *
   * A SEPARATE method rather than a field on `update`, for two reasons. It is the only company
   * write with a refusal condition of its own, and `update` would then carry two unrelated
   * concerns; and the refusal needs its own audit action so round 2 can find it by name instead
   * of reading through every `update_company` event.
   *
   * WHO MAY CALL IT: any signed-in person, exactly like every other company edit. ADR-0033 keeps
   * the detailed permission matrix out of round 1, and inventing an owner-or-admin rule here
   * would be the product's first such rule — on the evening of feature freeze. The `AuditEvent`
   * records the actor either way, so "who turned this on" stays answerable.
   */
  async setLiveSourceEnabled(
    actor: Actor,
    companyId: string,
    enabled: boolean,
  ): Promise<CompanyDto> {
    if (actor.kind === 'system') {
      await this.audit.recordRefusal(actor, 'enable_live_source', 'company', companyId, {
        reason: 'the AI may not choose which sources it reads (ADR-0022, extended by ADR-0035)',
      })
      throw new ForbiddenException('Hệ thống không được tự bật nguồn web thật')
    }

    /**
     * I-16, and only in the ENABLING direction. Moving a company toward the snapshot can never
     * threaten the reproducibility of T-1…T-10, and a symmetric refusal would leave a seed
     * company stuck on if the flag ever got set by hand or by a migration.
     */
    if (enabled && isSeedCompany(companyId)) {
      await this.audit.recordRefusal(actor, 'enable_live_source', 'company', companyId, {
        reason:
          'a seed company must read the stored snapshot only: T-6 and T-8 are triggered by ' +
          'flipping its snapshot, and an uncontrolled source makes them unrepeatable (I-16)',
      })
      throw new ForbiddenException(
        'Công ty thuộc bộ dữ liệu nghiệm thu chỉ được đọc bản chụp — không bật được nguồn web thật',
      )
    }

    const [updated] = await this.db
      .update(companies)
      .set({ liveSourceEnabled: enabled, updatedAt: new Date() })
      .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
      .returning()

    if (!updated) throw new NotFoundException('Không tìm thấy công ty')
    return toDto(updated)
  }

  /**
   * SOFT delete, and it stops at the company: opportunities and timeline entries keep their
   * rows and disappear from every screen because their queries join `companies` and filter
   * `deletedAt IS NULL`. Cascading the flag downwards would mean a new column on two more
   * tables, a migration, and an undelete that has to remember what it hid.
   */
  async softDelete(actor: Actor, companyId: string): Promise<void> {
    if (actor.kind === 'system') {
      await this.audit.recordRefusal(actor, 'delete_company', 'company', companyId, {
        reason: 'actor=system may never delete human-created data (ontology section 5)',
      })
      throw new ForbiddenException('Hệ thống không được xoá công ty')
    }

    await this.db
      .update(companies)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(companies.id, companyId))
  }
}

function toDto(row: typeof companies.$inferSelect): CompanyDto {
  return {
    id: row.id,
    name: row.name,
    industry: row.industry,
    companyType: row.companyType,
    country: row.country,
    size: row.size,
    website: row.website,
    isWatched: row.isWatched,
    /**
     * Exposed because the company screen has to show whether the live source is on — a switch
     * whose state is invisible is a switch nobody trusts. `snapshotVariant` stays out (it is demo
     * scaffolding, ADR-0022); this one is a real product setting a person turned on.
     */
    liveSourceEnabled: row.liveSourceEnabled,
  }
}
