import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, asc, desc, eq, ilike, isNull, sql } from 'drizzle-orm'

import type {
  CompanyDto,
  CreateCompanyDto,
  ListCompaniesQuery,
  Paginated,
  UpdateCompanyDto,
} from '@crm/contracts'
import { type CrmDatabase, companies } from '@crm/db'

import { DRIZZLE_APP } from '../../common/db/db.module'
import { AuditEventService } from '../../common/audit/audit-event-service'
import { isSeedCompany } from '../../ai/resolve-observation-source'
import type { Actor } from '../../common/actor/actor-context'
import { ownerScopeFor } from '../../common/actor/owner-scope'

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
  async list(
    query: ListCompaniesQuery = {},
    ownerId: string | null = null,
  ): Promise<Paginated<CompanyDto>> {
    const conditions = [isNull(companies.deletedAt)]
    /**
     * ADR-0046. `null` means an administrator and therefore no restriction; a user id narrows to
     * the companies that person looks after. Note what `eq` does with an unassigned company:
     * `NULL = x` is unknown, so a company with no owner drops out for Sales and stays visible to
     * an administrator — which is the intended reading, not an accident of SQL.
     */
    if (ownerId) conditions.push(eq(companies.ownerId, ownerId))
    // `ilike` with wrapping wildcards: Sales types a fragment of the name, not a prefix, and
    // the Vietnamese name they remember is rarely the one at the start of the legal name.
    if (query.q) conditions.push(ilike(companies.name, `%${query.q}%`))
    if (query.industry) conditions.push(eq(companies.industry, query.industry))
    if (query.companyType) {
      conditions.push(eq(companies.companyType, query.companyType))
    }
    if (query.country) conditions.push(eq(companies.country, query.country))
    if (query.isWatched !== undefined) conditions.push(eq(companies.isWatched, query.isWatched))

    const where = and(...conditions)

    /**
     * ORDER BY ends in `id` (ADR-0047). Two companies can share a name — a duplicate typed by
     * two people is ordinary — and without a unique last key their relative order between two
     * requests is undefined, so one could appear on two pages or on neither.
     *
     * Collation is Postgres', deliberately: sorting a page in the browser would only sort that
     * page. The Vietnamese ordering that gives is asserted by `company-list-pagination.test.ts`
     * rather than assumed.
     */
    const column = query.sortBy === 'industry' ? companies.industry : companies.name
    const direction = query.sortDir === 'desc' ? desc : asc
    const ordering = [direction(column), asc(companies.id)]

    const [{ total }] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(companies)
      .where(where)

    const base = this.db.select().from(companies).where(where).orderBy(...ordering)

    /** No `page` → the caller wants the whole list, and gets it in one page. */
    const rows = query.page
      ? await base.limit(query.pageSize ?? 20).offset((query.page - 1) * (query.pageSize ?? 20))
      : await base

    return {
      items: rows.map(toDto),
      total,
      page: query.page ?? 1,
      pageSize: query.page ? (query.pageSize ?? 20) : total,
    }
  }

  /**
   * NOT FOUND rather than FORBIDDEN when the company belongs to someone else (ADR-0046). A 403
   * would confirm that this id names a real company, which is one bit more than a person outside
   * the boundary is owed; the message is the same one an unknown id gets.
   */
  async byId(companyId: string, ownerId: string | null = null): Promise<CompanyDto> {
    const conditions = [eq(companies.id, companyId), isNull(companies.deletedAt)]
    if (ownerId) conditions.push(eq(companies.ownerId, ownerId))

    const [row] = await this.db
      .select()
      .from(companies)
      .where(and(...conditions))

    if (!row) throw new NotFoundException('Không tìm thấy công ty')
    return toDto(row)
  }

  /**
   * The visibility check the other domains borrow — observations, timeline, and anything else
   * hanging off a company. Kept here because "which companies exist for this reader" is this
   * service's question, and answering it in five places is how five answers start to differ.
   */
  async assertVisible(companyId: string, ownerId: string | null): Promise<void> {
    await this.byId(companyId, ownerId)
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

    /** ADR-0046 — outside the caller's boundary reads as "no such company", not as a refusal. */
    await this.assertVisible(companyId, ownerScopeFor(actor))

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

    /** ADR-0046 — the switch belongs to whoever looks after the company, not to anyone signed in. */
    await this.assertVisible(companyId, ownerScopeFor(actor))

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

    /** ADR-0046. Deleting someone else's company was the most damaging of the open write paths. */
    await this.assertVisible(companyId, ownerScopeFor(actor))

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
