import { Inject, Injectable } from '@nestjs/common'
import { and, eq, isNull, notInArray, sql, type SQL } from 'drizzle-orm'

import {
  CLOSED_STAGES,
  type OverviewDto,
  type OverviewPerSalesRow,
  type Stage,
} from '@crm/contracts'
import { type CrmDatabase, companies, opportunities, proposals, users } from '@crm/db'

import { DRIZZLE_APP } from '../../common/db/db.module'
import { OPPORTUNITY_SELECTION, toOpportunityDto } from '../opportunity/opportunity-service'
import { todayIso } from '../opportunity/opportunity-warnings'

/**
 * Who the summary is computed FOR, decided by the controller (ADR-0004: services never read
 * the ambient actor). `ownerId` scopes every figure to one sales' companies; `includePerSales`
 * adds the admin's whole-team table.
 *
 * This scoping used to be described here as "a VIEW, not authorization — every other screen
 * still shows everything to everyone". That stopped being true with ADR-0046: the same boundary
 * now governs every read and every write in the product, and this screen is one of its members
 * rather than the exception it was built as.
 */
export interface OverviewScope {
  ownerId?: string
  includePerSales?: boolean
}

/** Stages whose silence is deliberate: a paused deal is allowed to have no next step. */
const RESTING_STAGES: Stage[] = [...CLOSED_STAGES, 'on_hold']

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
 *
 * When an owner filter narrows the screen, a third number joins that family:
 * `unassignedCompanies` states how many companies NO filtered view can count, because they
 * have no owner — rule 4 prefers a labeled gap over a total that silently shrank.
 */
@Injectable()
export class OverviewService {
  constructor(@Inject(DRIZZLE_APP) private readonly db: CrmDatabase) {}

  async summary(scope: OverviewScope = {}): Promise<OverviewDto> {
    const { ownerId, includePerSales } = scope

    const [
      byIndustry,
      byStage,
      lostReasons,
      lostWithoutReason,
      overdue,
      dueSoon,
      missingNextStep,
      unassignedCompanies,
      perSales,
    ] = await Promise.all([
      this.companiesByIndustry(ownerId),
      this.opportunitiesByStage(ownerId),
      this.lostReasons(ownerId),
      this.lostWithoutReason(ownerId),
      this.overdueNextSteps(ownerId),
      this.dueSoonNextSteps(ownerId),
      this.missingNextSteps(ownerId),
      this.countUnassignedCompanies(),
      includePerSales ? this.perSalesRows() : Promise.resolve(undefined),
    ])

    const onHold = byStage.find((row) => row.stage === 'on_hold')

    return {
      companiesByIndustry: byIndustry,
      pipelineByStage: byStage.filter((row) => row.stage !== 'on_hold'),
      onHold: onHold ? { count: onHold.count, totalValue: onHold.totalValue } : { count: 0, totalValue: '0' },
      overdueNextSteps: overdue,
      dueSoon,
      missingNextStep,
      unassignedCompanies,
      perSales,
      lostReasons,
      lostWithoutReason,
    }
  }

  /** `and()` drops `undefined` members, so "no owner" and "this owner" share every query. */
  private ownedBy(ownerId?: string): SQL | undefined {
    return ownerId ? eq(companies.ownerId, ownerId) : undefined
  }

  private async companiesByIndustry(
    ownerId?: string,
  ): Promise<{ industry: string; count: number }[]> {
    const rows = await this.db
      .select({ industry: companies.industry, count: sql<number>`count(*)::int` })
      .from(companies)
      .where(and(isNull(companies.deletedAt), this.ownedBy(ownerId)))
      .groupBy(companies.industry)
      .orderBy(sql`count(*) DESC`)

    return rows
  }

  private async opportunitiesByStage(
    ownerId?: string,
  ): Promise<{ stage: Stage; count: number; totalValue: string }[]> {
    const rows = await this.db
      .select({
        stage: opportunities.stage,
        count: sql<number>`count(*)::int`,
        // `numeric` all the way, and COALESCE because an empty stage must read `0`, not null.
        totalValue: sql<string>`COALESCE(sum(${opportunities.expectedValue}), 0)::text`,
      })
      .from(opportunities)
      .innerJoin(companies, eq(companies.id, opportunities.companyId))
      .where(and(isNull(companies.deletedAt), this.ownedBy(ownerId)))
      .groupBy(opportunities.stage)

    return rows
  }

  private async lostReasons(ownerId?: string): Promise<{ reason: string; count: number }[]> {
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
          this.ownedBy(ownerId),
        ),
      )
      .groupBy(opportunities.lostReason)
      .orderBy(sql`count(*) DESC`)

    return rows
  }

  /** The line that stands next to the table, never a row inside it. */
  private async lostWithoutReason(ownerId?: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(opportunities)
      .innerJoin(companies, eq(companies.id, opportunities.companyId))
      .where(
        and(
          eq(opportunities.stage, 'lost'),
          isNull(companies.deletedAt),
          isNull(opportunities.lostReason),
          this.ownedBy(ownerId),
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
   *
   * `next_step_text IS NOT NULL` is what keeps each deal in exactly ONE block. The two columns
   * are independently nullable, so a deal can carry a past date and no text at all — late
   * against nothing. Such a deal belongs to the missing-next-step block; counted here as well
   * it would read as two problems on the admin's row when it is one.
   */
  private async overdueNextSteps(ownerId?: string) {
    const today = todayIso()
    const rows = await this.db
      .select(OPPORTUNITY_SELECTION)
      .from(opportunities)
      .innerJoin(companies, eq(companies.id, opportunities.companyId))
      .where(
        and(
          isNull(companies.deletedAt),
          sql`${opportunities.nextStepDueDate} < ${today}`,
          sql`${opportunities.nextStepText} IS NOT NULL`,
          this.ownedBy(ownerId),
        ),
      )
      .orderBy(opportunities.nextStepDueDate)

    return rows
      .map((row) => toOpportunityDto(row, today))
      .filter((dto) => dto.isOverdue && !(CLOSED_STAGES as readonly string[]).includes(dto.stage))
  }

  /**
   * Today through +3 days — far enough to see past a weekend, near enough to stay urgent.
   * Overdue rows are excluded by construction (`>= today`); they have their own block, and a
   * row that appeared in both would be counted twice by anyone adding the screen up.
   */
  private async dueSoonNextSteps(ownerId?: string) {
    const today = todayIso()
    const rows = await this.db
      .select(OPPORTUNITY_SELECTION)
      .from(opportunities)
      .innerJoin(companies, eq(companies.id, opportunities.companyId))
      .where(
        and(
          isNull(companies.deletedAt),
          sql`${opportunities.nextStepDueDate} >= ${today}`,
          sql`${opportunities.nextStepDueDate} <= ${today}::date + 3`,
          // Same one-block rule as the overdue query above: a date with no text is not a task.
          sql`${opportunities.nextStepText} IS NOT NULL`,
          this.ownedBy(ownerId),
        ),
      )
      .orderBy(opportunities.nextStepDueDate)

    return rows
      .map((row) => toOpportunityDto(row, today))
      .filter((dto) => !(CLOSED_STAGES as readonly string[]).includes(dto.stage))
  }

  /**
   * Rule 5 calls the next step the deal's heartbeat — these open deals have none at all
   * (no text or no date; either way nothing can ever come due). `on_hold` stays out: pausing
   * a deal is the one legitimate way for it to fall silent.
   */
  private async missingNextSteps(ownerId?: string) {
    const today = todayIso()
    const rows = await this.db
      .select(OPPORTUNITY_SELECTION)
      .from(opportunities)
      .innerJoin(companies, eq(companies.id, opportunities.companyId))
      .where(
        and(
          isNull(companies.deletedAt),
          sql`(${opportunities.nextStepText} IS NULL OR ${opportunities.nextStepDueDate} IS NULL)`,
          notInArray(opportunities.stage, RESTING_STAGES),
          this.ownedBy(ownerId),
        ),
      )
      .orderBy(sql`${opportunities.expectedValue} DESC`)

    return rows.map((row) => toOpportunityDto(row, today))
  }

  /**
   * Global, never owner-filtered: it names exactly what every filtered view is missing.
   *
   * "No owner" is not the same question as "no SALES owner", and only the second one is
   * useful here. Creating a company stamps the creator as owner, and an admin may create one
   * — that company then belongs to nobody's per-sales row and to no sales' scoped view. Left
   * counted as owned it would vanish from every view while this line still read zero, which
   * is the silent gap rule 4 forbids.
   */
  private async countUnassignedCompanies(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(companies)
      .where(
        and(
          isNull(companies.deletedAt),
          sql`(${companies.ownerId} IS NULL OR ${companies.ownerId} NOT IN (SELECT ${users.id} FROM ${users} WHERE ${users.role} = 'sales'))`,
        ),
      )

    return row?.count ?? 0
  }

  /**
   * One row per sales user for the admin's table. Two aggregate queries stitched by owner id
   * in JS — a single five-way JOIN with mixed grains (opportunities × proposals) would
   * multiply rows and quietly inflate every count.
   *
   * The two behavioral columns (overdue, missing next step) mirror the definitions used by
   * the blocks above ON PURPOSE: the admin drilling into one sales' view must see the same
   * numbers the table promised.
   */
  private async perSalesRows(): Promise<OverviewPerSalesRow[]> {
    const today = todayIso()

    const [salesUsers, opportunityAgg, proposalAgg] = await Promise.all([
      this.db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(eq(users.role, 'sales'))
        .orderBy(users.name),
      this.db
        .select({
          ownerId: companies.ownerId,
          /**
           * Both figures exclude `on_hold`, so the count and the money on one row describe
           * the SAME deals. Counting paused deals here while the sum next to it skips them
           * hands the admin "3 cơ hội · 720.000 ₫" where the total does not cover all three.
           * Paused deals keep their own tile on the screen above.
           */
          openCount: sql<number>`count(*) filter (where ${opportunities.stage} not in ('won', 'lost', 'on_hold'))::int`,
          runningPipeline: sql<string>`COALESCE(sum(${opportunities.expectedValue}) filter (where ${opportunities.stage} not in ('won', 'lost', 'on_hold')), 0)::text`,
          // `next_step_text IS NOT NULL` for the same reason the overdue query carries it:
          // one deal must not raise both the late count and the silent count.
          overdueCount: sql<number>`count(*) filter (where ${opportunities.nextStepDueDate} < ${today} and ${opportunities.nextStepText} is not null and ${opportunities.stage} not in ('won', 'lost'))::int`,
          missingNextStepCount: sql<number>`count(*) filter (where (${opportunities.nextStepText} is null or ${opportunities.nextStepDueDate} is null) and ${opportunities.stage} not in ('won', 'lost', 'on_hold'))::int`,
        })
        .from(opportunities)
        .innerJoin(companies, eq(companies.id, opportunities.companyId))
        .where(isNull(companies.deletedAt))
        .groupBy(companies.ownerId),
      this.db
        .select({
          ownerId: companies.ownerId,
          pending: sql<number>`count(*)::int`,
          oldestDays: sql<number>`floor(extract(epoch from now() - min(${proposals.createdAt})) / 86400)::int`,
        })
        .from(proposals)
        .innerJoin(companies, eq(companies.id, proposals.companyId))
        .where(and(eq(proposals.status, 'pending'), isNull(companies.deletedAt)))
        .groupBy(companies.ownerId),
    ])

    const opportunityByOwner = new Map(opportunityAgg.map((row) => [row.ownerId, row]))
    const proposalByOwner = new Map(proposalAgg.map((row) => [row.ownerId, row]))

    return salesUsers.map((user) => {
      const deals = opportunityByOwner.get(user.id)
      const queue = proposalByOwner.get(user.id)
      return {
        userId: user.id,
        name: user.name,
        runningPipeline: deals?.runningPipeline ?? '0',
        openCount: deals?.openCount ?? 0,
        overdueCount: deals?.overdueCount ?? 0,
        missingNextStepCount: deals?.missingNextStepCount ?? 0,
        pendingProposals: queue?.pending ?? 0,
        oldestPendingProposalDays: queue ? queue.oldestDays : null,
      }
    })
  }
}
