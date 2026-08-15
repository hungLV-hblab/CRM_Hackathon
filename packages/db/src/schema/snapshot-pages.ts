import { pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'

import { companies } from './companies'

/**
 * The stored "bản chụp" content Sales' company pages are read from — replaces the hand-typed
 * TypeScript constants that used to live in `apps/api/src/ai/demo-snapshots.ts` (ADR-0021),
 * which could only hold one page per company. Real companies have 3-4 pages each (homepage,
 * news, company-profile, recruit...), and ADR-0021 itself named this exact trigger to revisit
 * ("bộ bản chụp phình quá ~5 công ty").
 *
 * Written ONLY by the import path (`seed()`/`AdminImportService`, both running as `crm_owner`
 * or `crm_app`) — never by the AI. `crm_system` gets `SELECT` only, matching `company_sources`
 * (`0008_live_source.sql`): the AI reads which content is available, it never adds or edits a
 * page. Writing its own source would let it choose the evidence it then reports on.
 *
 * `before_html`/`after_html` both nullable: some real companies are missing one side (the BTC
 * data has this for real — a page pair that could not be captured), and `DemoSnapshotSource`
 * treats a missing HTML for the requested variant as "unreadable", same semantics as the old
 * Ohara fixture's empty string.
 */
export const snapshotPages = pgTable(
  'snapshot_pages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    pageSlug: text('page_slug').notNull(),
    sourceUrl: text('source_url'),
    beforeHtml: text('before_html'),
    afterHtml: text('after_html'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('snapshot_pages_company_id_page_slug_unique').on(table.companyId, table.pageSlug)],
)

export type SnapshotPage = typeof snapshotPages.$inferSelect
