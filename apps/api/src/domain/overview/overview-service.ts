import { Inject, Injectable } from '@nestjs/common'
import { and, eq, isNull, sql } from 'drizzle-orm'

import { CLOSED_STAGES, type OverviewDto, type Stage } from '@crm/contracts'
import { type CrmDatabase, companies, opportunities } from '@crm/db'

import { DRIZZLE_APP } from '../../common/db/db.module'
import { OPPORTUNITY_SELECTION, toOpportunityDto } from '../opportunity/opportunity-service'
import { todayIso } from '../opportunity/opportunity-warnings'

/**
 * The overview screen. Sales' own data only → `DRIZZLE_APP` alone; no branch here runs under
 * the system identity, so the system pool is absent rather than sitting around unused.
 *
 * Two numbers on this screen are deliberately NOT what the naive query would produce, and
 * both are the point of the screen rather than details of it:
 *
 * - `on_hold` is open (ontology 3.5) but is reported SEPARATELY from the running pipeline.
 *   Folded in, it inflates a total someone reads out in a meeting and commits to.
 * - a lost deal with no reason is counted on its own line, outside the reason table. Given a
 *   bucket inside the table it would be summed back in by the first person who adds the
 *   column up.
 */
@Injectable()
export class OverviewService {
  constructor(@Inject(DRIZZLE_APP) private readonly db: CrmDatabase) {}

  async summary(): Promise<OverviewDto> {
    const [byIndustry, byStage, lostReasons, lostWithoutReason, overdue] = await Promise.all([
      this.companiesByIndustry(),
      this.opportunitiesByStage(),
      this.lostReasons(),
      this.lostWithoutReason(),
      this.overdueNextSteps(),
    ])

    const onHold = byStage.find((row) => row.stage === 'on_hold')

    return {
      companiesByIndustry: byIndustry,
      pipelineByStage: byStage.filter((row) => row.stage !== 'on_hold'),
      onHold: onHold ? { count: onHold.count, totalValue: onHold.totalValue } : { count: 0, totalValue: '0' },
      overdueNextSteps: overdue,
      lostReasons,
      lostWithoutReason,
    }
  }

  private async companiesByIndustry(): Promise<{ industry: string; count: number }[]> {
    const rows = await this.db
      .select({ industry: companies.industry, count: sql<number>`count(*)::int` })
      .from(companies)
      .where(isNull(companies.deletedAt))
      .groupBy(companies.industry)
      .orderBy(sql`count(*) DESC`)

    return rows
  }

  private async opportunitiesByStage(): Promise<
    { stage: Stage; count: number; totalValue: string }[]
  > {
    const rows = await this.db
      .select({
        stage: opportunities.stage,
        count: sql<number>`count(*)::int`,
        // `numeric` all the way, and COALESCE because an empty stage must read `0`, not null.
        totalValue: sql<string>`COALESCE(sum(${opportunities.expectedValue}), 0)::text`,
      })
      .from(opportunities)
      .innerJoin(companies, eq(companies.id, opportunities.companyId))
      .where(isNull(companies.deletedAt))
      .groupBy(opportunities.stage)

    return rows
  }

  private async lostReasons(): Promise<{ reason: string; count: number }[]> {
    const rows = await this.db
      .select({
        reason: sql<string>`${opportunities.lostReason}`,
        count: sql<number>`count(*)::int`,
      })
      .from(opportunities)
      .innerJoin(companies, eq(companies.id, opportunities.companyId))
      .where(
        and(
          eq(opportunities.stage, 'lost'),
          isNull(companies.deletedAt),
          sql`${opportunities.lostReason} IS NOT NULL`,
        ),
      )
      .groupBy(opportunities.lostReason)
      .orderBy(sql`count(*) DESC`)

    return rows
  }

  /** The line that stands next to the table, never a row inside it. */
  private async lostWithoutReason(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(opportunities)
      .innerJoin(companies, eq(companies.id, opportunities.companyId))
      .where(
        and(
          eq(opportunities.stage, 'lost'),
          isNull(companies.deletedAt),
          isNull(opportunities.lostReason),
        ),
      )

    return row?.count ?? 0
  }

  /**
   * Rule 5 — "sáng nay tôi phải làm gì, cho deal nào".
   *
   * Filtered by the SAME `isOverdue` the board uses rather than by a hand-written WHERE, so
   * an opportunity with no next step drops off this list for the one reason it should: there
   * is no date for it to be late against.
   */
  private async overdueNextSteps() {
    const today = todayIso()
    const rows = await this.db
      .select(OPPORTUNITY_SELECTION)
      .from(opportunities)
      .innerJoin(companies, eq(companies.id, opportunities.companyId))
      .where(and(isNull(companies.deletedAt), sql`${opportunities.nextStepDueDate} < ${today}`))
      .orderBy(opportunities.nextStepDueDate)

    return rows
      .map((row) => toOpportunityDto(row, today))
      .filter((dto) => dto.isOverdue && !(CLOSED_STAGES as readonly string[]).includes(dto.stage))
  }
}
