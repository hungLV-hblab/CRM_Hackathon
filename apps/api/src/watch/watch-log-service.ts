import { Inject, Injectable } from '@nestjs/common'
import { desc } from 'drizzle-orm'

import type { WatchCycleRunDto } from '@crm/contracts'
import { type CrmDatabase, watchCycleRuns } from '@crm/db'

import { DRIZZLE_APP } from '../common/db/db.module'

/** How many rows the log screen asks for. A log page, not the whole history. */
const DEFAULT_LIMIT = 100

/**
 * "Nhật ký vòng quét" — the read side of the watch-cycle log.
 *
 * Specs asks for a per-cycle line, and the reason it is a REQUIREMENT rather than a nicety is
 * that zone 4 writes without asking: the log is the only place the loop can be inspected after
 * the fact, and round 2 asks its questions from it.
 *
 * Reads under `crm_app`. Sales is the reader — the worker writes these rows under `crm_system`
 * and never reads them back, so giving this service the system pool would create a second path
 * into the table with no rule attached to it.
 */
@Injectable()
export class WatchLogService {
  constructor(@Inject(DRIZZLE_APP) private readonly dbApp: CrmDatabase) {}

  /**
   * Newest first. Rolled-up rows are NOT filtered out and NOT separated into their own list:
   * they carry `isRollup` and sit in the stream where their `startedAt` puts them, which is
   * after the ten cycles they summarise. Splitting them into a second query would let the screen
   * show a summary next to a set of cycles it does not actually cover.
   */
  async list(): Promise<WatchCycleRunDto[]> {
    const rows = await this.dbApp
      .select()
      .from(watchCycleRuns)
      .orderBy(desc(watchCycleRuns.startedAt), desc(watchCycleRuns.isRollup))
      .limit(DEFAULT_LIMIT)

    return rows.map((row) => ({
      id: row.id,
      startedAt: row.startedAt.toISOString(),
      durationMs: row.durationMs,
      companiesScanned: row.companiesScanned,
      newContentCount: row.newContentCount,
      entriesAdded: row.entriesAdded,
      errorCount: row.errorCount,
      errorDetail: row.errorDetail,
      skippedReason: row.skippedReason,
      isRollup: row.isRollup,
      cyclesCovered: row.cyclesCovered,
    }))
  }
}
