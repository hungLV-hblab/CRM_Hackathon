import { ForbiddenException, Inject, Injectable } from '@nestjs/common'
import { asc, isNull } from 'drizzle-orm'

import type { CompanyDto, CreateCompanyDto } from '@crm/contracts'
import { type CrmDatabase, companies } from '@crm/db'

import { DRIZZLE_APP } from '../../common/db/db.module'
import { AuditEventService } from '../../common/audit/audit-event-service'
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

  async list(): Promise<CompanyDto[]> {
    const rows = await this.db
      .select()
      .from(companies)
      .where(isNull(companies.deletedAt))
      .orderBy(asc(companies.name))

    return rows.map(toDto)
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
  }
}
