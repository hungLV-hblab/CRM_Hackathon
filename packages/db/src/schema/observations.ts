import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { companies } from './companies'
import { fetchStatusEnum } from './enums'

/**
 * ontology 3.2 — "bản lưu". Autonomy zone 1: the AI creates these freely, because nothing
 * here touches Sales' official data.
 *
 * ADR-0012 keeps BOTH representations of a snapshot:
 * - `rawHtml` is the page exactly as fetched, for the "Bản gốc" tab.
 * - `rawContent` is the normalised text extracted from it. Quote offsets (`quote_start` /
 *   `quote_end` on `Claim`) and `contentHash` are computed on THIS string, never on the HTML
 *   — otherwise a markup change with identical text would read as new content.
 *
 * NO unique constraint on `(company_id, content_hash)`, deliberately (ADR-0017). I-3 says
 * "different from the MOST RECENT snapshot", which a global unique index does not say: it
 * also rejects the sequence before → after → before, and that sequence is exactly what a
 * judge does when replaying the T-6/T-8 script a second time. I-3 is a behaviour rule
 * (anti-spam, LLM cost), not a safety boundary, so it is enforced in the service and tested
 * there; the index below only makes "fetch the latest one" cheap.
 *
 * `fetchStatus = 'failed'` when the source could not be read. Never guessed (ontology 3.5).
 */
export const observations = pgTable(
  'observations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    sourceUrl: text('source_url').notNull(),
    /**
     * ADR closing the ontology's open question: `text`, not the 1–6 integer tower. Only one
     * tier exists so far, and `'company_website'` reads as itself in a log line. A second
     * tier (news, LinkedIn) is a new value, not an `ALTER TYPE`.
     */
    sourceTier: text('source_tier').notNull().default('company_website'),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
    rawHtml: text('raw_html'),
    rawContent: text('raw_content').notNull(),
    /** Version of the HTML→text extractor, so old offsets stay interpretable. */
    extractorVersion: text('extractor_version').notNull(),
    /** Computed over `rawContent`, per ADR-0012. */
    contentHash: text('content_hash').notNull(),
    fetchStatus: fetchStatusEnum('fetch_status').notNull(),
    /**
     * Which kind of source produced this row (ADR-0035 · ontology 3.6): `demo_snapshot` for the
     * stored pages every acceptance check runs on, `live_crawl` for a real public page.
     *
     * NOT decoration — it is read at runtime to lower the autonomy ceiling. A finding drawn from
     * `live_crawl` may only ever become a `Proposal` (I-15): no timeline entry, no auto next
     * step, however watched the company is. Zones 3 and 4 are safe because the CONTENT of the
     * snapshot set was vetted by a human, not because an undo button exists.
     *
     * `text` + CHECK rather than a pg enum, matching `source_tier` and `snapshot_variant`: adding
     * a value must not need an `ALTER TYPE`.
     */
    sourceKind: text('source_kind').notNull().default('demo_snapshot'),
    /**
     * Why the read failed, when it did. NULL on every successful read — and the CHECK in
     * `0008_live_source.sql` enforces that pairing, because a reason attached to a successful
     * read would let the failure dashboard count reads that worked.
     *
     * The valuable value is `js_required`: Specs group 2 has ONE state for an unreadable source,
     * which cannot separate "the site blocked our reader" from "the company published nothing".
     * That distinction is what a Sales Manager asked for in the 14/08 requirement challenge.
     */
    fetchErrorReason: text('fetch_error_reason'),
  },
  (table) => [
    index('observations_company_captured_at_idx').on(table.companyId, table.capturedAt),
    /**
     * I-3 compares against the latest observation OF THE SAME URL, not of the company
     * (ADR-0036). With several sources per company the per-company comparison cross-checks URL A
     * against URL B's row, so every read would store N new rows and pay for N LLM calls. Still
     * enforced in the service, never as a UNIQUE index — ADR-0017 explains why.
     */
    index('observations_company_source_url_captured_at_idx').on(
      table.companyId,
      table.sourceUrl,
      table.capturedAt,
    ),
  ],
)

export type Observation = typeof observations.$inferSelect
