import { Inject, Injectable } from '@nestjs/common'
import { and, eq, isNotNull, sql } from 'drizzle-orm'

import type {
  DecisionTimeDto,
  DistributionRow,
  ErrorDetectionRateDto,
  MetricsDto,
  RateDto,
} from '@crm/contracts'
import {
  type CrmDatabase,
  auditEvents,
  autoNextStepEvents,
  claims,
  proposalDecisions,
  proposals,
  timelineEntries,
} from '@crm/db'

import { DELETE_SYSTEM_TIMELINE_ENTRY_ACTION } from '../../watch/system-timeline-entry-removal-service'
import { DRIZZLE_APP } from '../../common/db/db.module'

/**
 * ontology section 7, computed. Every query here is a READ under the human identity — the
 * dashboard changes nothing, so the system pool is absent rather than sitting around unused.
 *
 * Two rules run through the whole file and both come from CLAUDE.md rule 4:
 *
 *   1. A rate with a zero denominator is `null`, NEVER 0. `0%` beside "Error-detection rate"
 *      reads as "the AI is wrong every time" to anyone scanning the page — a fabricated fact
 *      dressed as a measurement.
 *   2. Every rate carries its numerator and denominator. 1 of 1 is 100% and means nothing;
 *      a screen printing only the percentage invites a conclusion the sample cannot support.
 *
 * I-12 is structural rather than remembered: `accept` and `edit` are separate values of
 * `decision`, counted separately, and there is no column anywhere holding "was accepted" that
 * could be summed by accident.
 */
@Injectable()
export class MetricsService {
  constructor(@Inject(DRIZZLE_APP) private readonly db: CrmDatabase) {}

  async summary(): Promise<MetricsDto> {
    const [
      decisions,
      rejectReasons,
      autoSteps,
      proposalCount,
      systemEntryCount,
      deleteReasons,
      confidences,
      decisionTime,
    ] = await Promise.all([
      this.decisionCounts(),
      this.rejectReasonCounts(),
      this.autoNextStepCounts(),
      this.countOf(proposals),
      this.systemTimelineEntryCount(),
      this.systemEntryDeleteReasons(),
      this.confidenceCounts(),
      this.decisionTime(),
    ])

    const totalDecisions = decisions.accept + decisions.edit + decisions.reject

    return {
      autoAcceptRate: rate(decisions.accept, totalDecisions),
      editRate: rate(decisions.edit, totalDecisions),
      errorDetectionRate: this.errorDetectionRate(
        {
          rejectedWrongInfo: countFor(rejectReasons, 'wrong_info'),
          rejectedMisreadContext: countFor(rejectReasons, 'misread_context'),
          undoneAutoNextSteps: autoSteps.undone,
          deletedSystemEntries: sum(deleteReasons),
        },
        {
          proposals: proposalCount,
          autoNextStepEvents: autoSteps.total,
          systemTimelineEntries: systemEntryCount,
        },
      ),
      undoRate: rate(autoSteps.undone, autoSteps.total),
      rejectReasons,
      confidences,
      decisionTime,
      systemEntryDeleteReasons: deleteReasons,
    }
  }

  /**
   * ADR-0031. The denominator is the three sets the AI put IN FRONT OF A PERSON, because those
   * are exactly what a person is in a position to reject. Adding `claims` inflates it five- to
   * tenfold with findings that never reached anybody, and a ratio pinned near zero forever is a
   * number that can never be wrong — which is another way of saying it measures nothing.
   */
  private errorDetectionRate(
    numeratorBreakdown: ErrorDetectionRateDto['numeratorBreakdown'],
    denominatorBreakdown: ErrorDetectionRateDto['denominatorBreakdown'],
  ): ErrorDetectionRateDto {
    const numerator =
      numeratorBreakdown.rejectedWrongInfo +
      numeratorBreakdown.rejectedMisreadContext +
      numeratorBreakdown.undoneAutoNextSteps +
      numeratorBreakdown.deletedSystemEntries
    const denominator =
      denominatorBreakdown.proposals +
      denominatorBreakdown.autoNextStepEvents +
      denominatorBreakdown.systemTimelineEntries

    return { ...rate(numerator, denominator), numeratorBreakdown, denominatorBreakdown }
  }

  private async decisionCounts(): Promise<{ accept: number; edit: number; reject: number }> {
    const rows = await this.db
      .select({
        decision: proposalDecisions.decision,
        count: sql<number>`count(*)::int`,
      })
      .from(proposalDecisions)
      .groupBy(proposalDecisions.decision)

    const byDecision = new Map(rows.map((row) => [row.decision, row.count]))
    return {
      accept: byDecision.get('accept') ?? 0,
      edit: byDecision.get('edit') ?? 0,
      reject: byDecision.get('reject') ?? 0,
    }
  }

  /** Only `reject` rows carry a reason; the column is NULL on the other two by construction. */
  private async rejectReasonCounts(): Promise<DistributionRow[]> {
    const rows = await this.db
      .select({
        key: sql<string>`${proposalDecisions.rejectReason}`,
        count: sql<number>`count(*)::int`,
      })
      .from(proposalDecisions)
      .where(
        and(eq(proposalDecisions.decision, 'reject'), isNotNull(proposalDecisions.rejectReason)),
      )
      .groupBy(proposalDecisions.rejectReason)
      .orderBy(sql`count(*) DESC`)

    return rows
  }

  private async autoNextStepCounts(): Promise<{ total: number; undone: number }> {
    const [row] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        undone: sql<number>`count(${autoNextStepEvents.undoneAt})::int`,
      })
      .from(autoNextStepEvents)

    return { total: row?.total ?? 0, undone: row?.undone ?? 0 }
  }

  private async systemTimelineEntryCount(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(timelineEntries)
      .where(eq(timelineEntries.createdBy, 'system'))

    return row?.count ?? 0
  }

  /**
   * "Số lần xoá mục hệ thống" — the contract phase 7 left behind, read from `audit_events`
   * rather than from the rows themselves for the obvious reason: the rows are gone.
   *
   * TWO filters that look redundant and are not. The same action name is written when the SYSTEM
   * identity is REFUSED a deletion (`outcome: 'refused'`), and counting those would credit the AI
   * being blocked as a human catching a mistake — inflating the very metric that is supposed to
   * measure the person.
   */
  private async systemEntryDeleteReasons(): Promise<DistributionRow[]> {
    const rows = await this.db
      .select({
        key: sql<string>`COALESCE(${auditEvents.detail}->>'reason', 'khác')`,
        count: sql<number>`count(*)::int`,
      })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.action, DELETE_SYSTEM_TIMELINE_ENTRY_ACTION),
          eq(auditEvents.actor, 'human'),
          sql`${auditEvents.detail}->>'outcome' = 'done'`,
        ),
      )
      .groupBy(sql`COALESCE(${auditEvents.detail}->>'reason', 'khác')`)
      .orderBy(sql`count(*) DESC`)

    return rows
  }

  private async confidenceCounts(): Promise<DistributionRow[]> {
    const rows = await this.db
      .select({ key: sql<string>`${claims.confidence}`, count: sql<number>`count(*)::int` })
      .from(claims)
      .groupBy(claims.confidence)
      .orderBy(sql`count(*) DESC`)

    return rows
  }

  /**
   * Median, not mean: a single reviewer who wandered off for an hour would drag an average
   * somewhere nobody's actual experience is.
   *
   * `missingTimestamps` is reported next to it because ADR-0025 lets `seconds_to_decide` be NULL
   * when a page reload loses the mark — a median quoted without saying how many rows had no mark
   * is a number nobody can check.
   */
  private async decisionTime(): Promise<DecisionTimeDto> {
    const [row] = await this.db
      .select({
        median: sql<
          string | null
        >`percentile_cont(0.5) WITHIN GROUP (ORDER BY ${proposalDecisions.secondsToDecide})`,
        sampleSize: sql<number>`count(${proposalDecisions.secondsToDecide})::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(proposalDecisions)

    const sampleSize = row?.sampleSize ?? 0
    return {
      // `percentile_cont` returns NULL over an empty set, which is exactly the "chưa có dữ liệu"
      // case — so it is passed through rather than coerced to 0.
      medianSeconds: sampleSize > 0 && row?.median != null ? Number(row.median) : null,
      sampleSize,
      missingTimestamps: (row?.total ?? 0) - sampleSize,
    }
  }

  private async countOf(table: typeof proposals): Promise<number> {
    const [row] = await this.db.select({ count: sql<number>`count(*)::int` }).from(table)
    return row?.count ?? 0
  }
}

/** The one place a rate is built, so the zero-denominator rule cannot be forgotten in one of them. */
function rate(numerator: number, denominator: number): RateDto {
  return { rate: denominator === 0 ? null : numerator / denominator, numerator, denominator }
}

function countFor(rows: DistributionRow[], key: string): number {
  return rows.find((row) => row.key === key)?.count ?? 0
}

function sum(rows: DistributionRow[]): number {
  return rows.reduce((total, row) => total + row.count, 0)
}
