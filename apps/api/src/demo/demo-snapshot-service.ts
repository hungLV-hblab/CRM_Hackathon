import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, eq, isNull } from 'drizzle-orm'

import { type CrmDatabase, companies } from '@crm/db'

import { DRIZZLE_APP } from '../common/db/db.module'
import type { SnapshotVariant } from '../ai/demo-snapshots'

export interface SnapshotVariantResult {
  id: string
  name: string
  snapshotVariant: SnapshotVariant
}

/**
 * Flipping a company between the stored `before` and `after` snapshots — the demo control
 * behind acceptance checks 6 and 8, which both start with "change the source".
 *
 * `DRIZZLE_APP` ONLY, and that is the whole point of the service existing separately: the flip
 * is a HUMAN act. `crm_system` holds SELECT on `companies` and no UPDATE, so even a stray call
 * from the AI branch could not reach this column — an AI able to switch its own source could
 * manufacture the news it then reports.
 *
 * It lives in `demo/` rather than in `domain/company/` because it is scaffolding, not part of
 * Sales' data model: `CompanyDto` does not carry the column and no screen reads it.
 */
@Injectable()
export class DemoSnapshotService {
  constructor(@Inject(DRIZZLE_APP) private readonly db: CrmDatabase) {}

  async setVariant(companyId: string, variant: SnapshotVariant): Promise<SnapshotVariantResult> {
    const [updated] = await this.db
      .update(companies)
      .set({ snapshotVariant: variant, updatedAt: new Date() })
      .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
      .returning({
        id: companies.id,
        name: companies.name,
        snapshotVariant: companies.snapshotVariant,
      })

    if (!updated) throw new NotFoundException('Không tìm thấy công ty')
    return { ...updated, snapshotVariant: updated.snapshotVariant as SnapshotVariant }
  }
}
