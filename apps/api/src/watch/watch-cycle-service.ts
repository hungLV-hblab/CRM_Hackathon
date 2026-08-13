import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { eq } from 'drizzle-orm'

import {
  SKIP_REASON_AI_DISABLED,
  SKIP_REASON_PREVIOUS_CYCLE_RUNNING,
  type CrmDatabase,
  companies,
  watchCycleRuns,
} from '@crm/db'

import { DRIZZLE_SYSTEM } from '../common/db/db.module'
import { ObservationService } from '../domain/observation/observation-service'
import { SystemSettingService } from '../settings/system-setting-service'
import { WatchCycleRollup } from './watch-cycle-rollup'
import type { SnapshotVariant } from '../ai/demo-snapshots'

/**
 * ADR-0011 — a SELF-RESCHEDULING loop, not `@Cron`.
 *
 * Three requirements converge here, which is exactly why `@Cron` was rejected:
 *   T-9           switching the AI off mid-flight must take effect at once
 *                 → read `SystemSetting` EVERY tick, never cache
 *   I-10          a tick that is still running makes the next one skip
 *                 → `scanning` flag + scheduling that is INDEPENDENT of scan duration
 *   ontology 3.4  the cycle length is configurable in the database
 *                 → `setTimeout` uses the seconds just read, not a compile-time constant
 *
 * The order inside `tick()` is not arbitrary: SCHEDULE THE NEXT TICK BEFORE SCANNING. Put
 * the scheduling at the end, after awaiting the scan, and a scan that overruns its cycle
 * pushes the next tick out by itself — the I-10 situation then never occurs and the
 * `scanning` flag becomes decoration.
 *
 * Accepted consequence: changing `watch_cycle_seconds` in the database takes effect from the
 * next scheduling decision, i.e. within ≤1 cycle (exactly measurement 2 that ADR-0011 still
 * owed). Not instantly — instant would need a notification channel from the API to the
 * worker, and both ADR-0010 and ADR-0011 deliberately keep the database as the only channel.
 */
@Injectable()
export class WatchCycleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('WatchCycle')
  private timer?: ReturnType<typeof setTimeout>
  private stopped = false

  /**
   * An in-process flag. ASSUMPTION: exactly ONE worker (ADR-0011, Consequences — 12 to 15
   * companies, one watch cycle). Run several workers in parallel and this flag is useless;
   * it would have to become a database lock (`SELECT ... FOR UPDATE` or an advisory lock).
   */
  private scanning = false

  /**
   * The tick currently in flight. Kept so shutdown can wait for it instead of cutting it off
   * mid-write — and so tests can await the exact moment a tick finishes (advancing a fake
   * clock only fires `setTimeout`; it knows nothing about a Postgres query in flight).
   */
  private currentTick?: Promise<void>

  constructor(
    private readonly settings: SystemSettingService,
    @Inject(DRIZZLE_SYSTEM) private readonly db: CrmDatabase,
    private readonly observations: ObservationService,
    private readonly rollup: WatchCycleRollup,
  ) {}

  onModuleInit(): void {
    this.currentTick = this.tick()
  }

  /** Leave the `setTimeout` behind and the process never exits, hanging tests until timeout. */
  async onModuleDestroy(): Promise<void> {
    this.stopped = true
    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
    await this.awaitCurrentTick()
  }

  /** Waits for the in-flight tick. Swallows errors: they are already in the watch-cycle log. */
  async awaitCurrentTick(): Promise<void> {
    await this.currentTick?.catch(() => undefined)
  }

  private async tick(): Promise<void> {
    if (this.stopped) return

    const parameters = await this.settings.read()
    this.scheduleNextTick(parameters.watchCycleSeconds)

    await this.runCycle(parameters)

    /**
     * The rolled-up line is attempted after EVERY recorded cycle, scanned or skipped, and that
     * placement is the decision rather than a detail. A skipped tick is still a cycle — it
     * happened and chose not to scan (T-9, I-10) — so ten cycles of a switched-off AI have to
     * produce their summary too. Put this inside `scan()` instead and a log full of skips never
     * summarises anything, which is exactly the stretch a reader most needs summarised.
     *
     * It is safe to call unconditionally: the statement's own `HAVING count(*) >= 10` means a
     * batch shorter than ten writes nothing, so no counter has to be kept in step out here.
     */
    await this.rollup.maybeWrite()
  }

  /** One cycle's decision and its log row. Always writes exactly one row. */
  private async runCycle(parameters: { aiEnabled: boolean }): Promise<void> {
    if (!parameters.aiEnabled) {
      await this.recordSkippedTick(SKIP_REASON_AI_DISABLED)
      return
    }
    if (this.scanning) {
      await this.recordSkippedTick(SKIP_REASON_PREVIOUS_CYCLE_RUNNING)
      return
    }

    this.scanning = true
    const startedAt = Date.now()
    try {
      await this.scan(startedAt)
    } catch (error) {
      await this.recordError(startedAt, error as Error)
    } finally {
      this.scanning = false
    }
  }

  /**
   * One cycle: read every watched company's source and let the reaction chain do the rest.
   *
   * Deliberately NOT reimplementing any of it. `ObservationService.ingest()` already compares
   * hashes (I-3), extracts findings, and hands them to groups 4, 3 and 5 in that order — a
   * second copy of that logic living in the worker is how the manual path and the automatic path
   * start behaving differently, which is the exact bug ADR-0028 was written to undo.
   *
   * ── PER-COMPANY try/catch, and the cycle never dies ────────────────────────────────────
   * One unreachable source, one model timeout, one company row missing a snapshot must not stop
   * the other companies from being read or stop the log row from being written. A cycle that
   * throws leaves NO row, and a log with a gap in it cannot be told apart from a worker that is
   * dead — which is the same reason a skipped tick writes a row (ADR-0011).
   *
   * ── Which snapshot: the COLUMN, never an argument ──────────────────────────────────────
   * ADR-0022. The cycle fires on a timer and nobody passes it anything, so `snapshot_variant` on
   * the company row is the only place "which page is this company's source right now" can come
   * from. Read per company, inside the same SELECT that finds the watched ones.
   */
  private async scan(startedAt: number): Promise<void> {
    const watched = await this.db
      .select({
        id: companies.id,
        name: companies.name,
        snapshotVariant: companies.snapshotVariant,
      })
      .from(companies)
      .where(eq(companies.isWatched, true))

    let newContentCount = 0
    let entriesAdded = 0
    let errorCount = 0
    const errors: string[] = []

    for (const company of watched) {
      try {
        const result = await this.observations.ingest(
          company.id,
          company.snapshotVariant as SnapshotVariant,
          'watch_cycle',
        )

        /**
         * "New content" means a snapshot that actually differed. A failed read is NOT new
         * content — it produces a row (the attempt is a fact) but no findings, and counting it
         * would make an outage look like a productive cycle.
         */
        if (!result.unchanged && result.fetchStatus === 'ok') newContentCount += 1
        entriesAdded += result.systemEntriesAdded
      } catch (error) {
        errorCount += 1
        errors.push(`${company.name}: ${(error as Error).message}`)
        this.logger.error(`Vòng quét lỗi ở công ty ${company.name}: ${(error as Error).message}`)
      }
    }

    await this.db.insert(watchCycleRuns).values({
      startedAt: new Date(startedAt),
      durationMs: Date.now() - startedAt,
      companiesScanned: watched.length,
      newContentCount,
      entriesAdded,
      errorCount,
      errorDetail: errors.length > 0 ? errors.join(' · ') : null,
    })

    this.logger.log(
      `WatchCycleRun: quét ${watched.length} công ty · ${newContentCount} có nội dung mới · ` +
        `${entriesAdded} mục dòng thời gian tự thêm · ${errorCount} lỗi`,
    )
  }

  private async recordSkippedTick(reason: string): Promise<void> {
    await this.db.insert(watchCycleRuns).values({ skippedReason: reason, durationMs: 0 })
    this.logger.log(`WatchCycleRun: tick skipped (${reason})`)
  }

  private async recordError(startedAt: number, error: Error): Promise<void> {
    await this.db.insert(watchCycleRuns).values({
      startedAt: new Date(startedAt),
      durationMs: Date.now() - startedAt,
      errorCount: 1,
      errorDetail: error.message,
    })
    this.logger.error(`Watch cycle failed: ${error.message}`)
  }

  private scheduleNextTick(seconds: number): void {
    if (this.stopped) return
    this.timer = setTimeout(() => {
      this.currentTick = this.tick()
    }, seconds * 1000)
    /**
     * The timer is deliberately NOT `unref()`-ed, and that is load-bearing for the worker.
     *
     * In the API process something else (the HTTP server) holds the event loop open, so an
     * unref'd timer looks harmless. In the worker this timer is the ONLY handle: unref it and
     * Node considers the process finished the moment the first tick returns, the container
     * exits, Docker restarts it, and the "cycle" becomes a restart loop that logs one line per
     * restart. It looks almost right in the log, which is what makes it dangerous — measured
     * on the compose stack, roughly one restart every 11 seconds instead of a 60s cycle.
     *
     * Nothing hangs as a result: `onModuleDestroy` clears the timer, which is how tests and
     * `docker compose down` both exit cleanly.
     */
  }
}
