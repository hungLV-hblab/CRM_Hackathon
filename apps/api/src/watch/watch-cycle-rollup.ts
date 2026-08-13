import { Inject, Injectable, Logger } from '@nestjs/common'
import { sql } from 'drizzle-orm'

import type { CrmDatabase } from '@crm/db'

import { DRIZZLE_SYSTEM } from '../common/db/db.module'

/** Specs: a rolled-up line "every ten cycles". Not a tuning knob — the log's reading rhythm. */
export const CYCLES_PER_ROLLUP = 10

/**
 * The summary line the watch-cycle log grows every ten cycles.
 *
 * With a 60-second cycle the log adds 1,440 rows a day and "what has the machine been doing"
 * stops being answerable by scrolling. The rolled-up row is the answer at a glance; the
 * individual rows stay, because a per-cycle number is what makes `entries_added = 0` while
 * `new_content_count > 0` visible, and that pair is the signal that the filter or the prompt is
 * wrong rather than the sources being quiet.
 *
 * ── ONE statement, and every value stays inside the database ────────────────────────────────
 * The watermark is a subquery, not a timestamp this process read and sent back down. Feature
 * group 4 already paid for that lesson: `timestamptz` keeps microseconds, a JavaScript `Date`
 * keeps milliseconds, so a value that makes a round trip comes back subtly rounded and compares
 * false against the very row it came from. Nothing here leaves Postgres, so nothing can round.
 *
 * `max(started_at)`, deliberately, NOT `min`: the summary must sort AFTER the ten rows it
 * summarises, or the log reads as though the total arrived before its parts.
 *
 * `HAVING count(*) >= CYCLES_PER_ROLLUP` is what makes the whole thing idempotent — below ten
 * unrolled cycles the SELECT yields no row, so the INSERT writes nothing and the caller can run
 * it after every single cycle without a counter of its own to keep in step.
 *
 * A SKIPPED tick counts as a cycle. It is a cycle that happened and chose not to scan (T-9,
 * I-10), and excluding it would make ten rolled-up cycles mean an unpredictable amount of time.
 */
@Injectable()
export class WatchCycleRollup {
  private readonly logger = new Logger('WatchCycleRollup')

  constructor(@Inject(DRIZZLE_SYSTEM) private readonly db: CrmDatabase) {}

  /** True when a summary row was written. */
  async maybeWrite(): Promise<boolean> {
    const result = await this.db.execute(sql`
      INSERT INTO watch_cycle_runs
        (started_at, duration_ms, companies_scanned, new_content_count, entries_added,
         error_count, is_rollup, cycles_covered)
      SELECT max(started_at), sum(duration_ms)::int, sum(companies_scanned)::int,
             sum(new_content_count)::int, sum(entries_added)::int, sum(error_count)::int,
             true, count(*)::int
      FROM watch_cycle_runs
      WHERE is_rollup = false
        AND started_at > coalesce(
              (SELECT max(started_at) FROM watch_cycle_runs WHERE is_rollup), '-infinity')
      HAVING count(*) >= ${CYCLES_PER_ROLLUP}
    `)

    const written = (result.rowCount ?? 0) > 0
    if (written) {
      this.logger.log(`Nhật ký vòng quét: đã thêm một dòng cộng dồn ${CYCLES_PER_ROLLUP} vòng`)
    }
    return written
  }
}
