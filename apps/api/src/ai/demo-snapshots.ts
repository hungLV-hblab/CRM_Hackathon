import { Inject, Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'

import { type CrmDatabase, snapshotPages } from '@crm/db'

import { DRIZZLE_SYSTEM } from '../common/db/db.module'

/**
 * Stored snapshots of company pages, up to N per company: `before` and `after` variants of
 * each page (homepage, news, company profile, recruit...).
 *
 * Replaces the hand-typed TypeScript map that used to live in this file (ADR-0021) — that
 * design held for 1 page × 5 companies, and ADR-0021 itself named its own revisit trigger
 * ("phình quá ~5 công ty"): the real BTC dataset is 24 companies × up to 4 pages each. Content
 * now lives in `snapshot_pages`, populated by `seed()`/the admin import path, never by this
 * class — it only reads.
 *
 * `crm_system`, not `crm_app`: creating an `Observation` from this content is an act of the AI
 * branch (autonomy zone 1), so the AI identity is the reader regardless of who pressed the
 * button that triggered it — same reasoning `ObservationService` already applies.
 */

export type SnapshotVariant = 'before' | 'after'

export interface Snapshot {
  sourceUrl: string
  rawHtml: string
}

@Injectable()
export class DemoSnapshotSource {
  constructor(@Inject(DRIZZLE_SYSTEM) private readonly db: CrmDatabase) {}

  /**
   * Every readable page of this company for the given variant. A page whose HTML for that
   * variant is missing or blank is simply left out — the caller (`ObservationService`) already
   * knows how to report "nothing came back" as a failed read when the whole list is empty.
   */
  async readAll(companyId: string, variant: SnapshotVariant): Promise<Snapshot[]> {
    const rows = await this.db
      .select()
      .from(snapshotPages)
      .where(eq(snapshotPages.companyId, companyId))

    const results: Snapshot[] = []
    for (const row of rows) {
      const html = variant === 'before' ? row.beforeHtml : row.afterHtml
      if (!html || html.trim().length === 0) continue
      results.push({
        sourceUrl: row.sourceUrl ?? `unknown#${row.pageSlug}`,
        rawHtml: html,
      })
    }
    return results
  }

  /** Used by the UI to show a source URL even when nothing was readable. */
  async sourceUrlFor(companyId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ sourceUrl: snapshotPages.sourceUrl })
      .from(snapshotPages)
      .where(and(eq(snapshotPages.companyId, companyId)))
      .limit(1)
    return row?.sourceUrl ?? null
  }
}
